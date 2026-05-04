require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  GetCommand,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb');

const app = express();
const PORT = process.env.PORT || 5000;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const BOOKINGS_TABLE = process.env.BOOKINGS_TABLE || 'MoveProBookings';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(origin => origin.trim());

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS blocked for this origin'));
    }
  })
);

const rates = {
  laborOnly: { base: 120, perHourPerMover: 55, truck: 0 },
  localMove: { base: 180, perHourPerMover: 70, truck: 95 },
  packing: { base: 100, perHourPerMover: 50, truck: 0 },
  junkRemoval: { base: 150, perHourPerMover: 45, truck: 125 }
};

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function calculateQuote(input) {
  const serviceType = cleanString(input.serviceType) || 'localMove';
  const selectedRate = rates[serviceType] || rates.localMove;
  const movers = Math.max(2, Math.min(Number(input.movers || 2), 6));
  const hours = Math.max(2, Math.min(Number(input.hours || 2), 12));
  const distanceMiles = Math.max(0, Math.min(Number(input.distanceMiles || 0), 300));
  const stairs = Math.max(0, Math.min(Number(input.stairs || 0), 10));
  const heavyItems = Math.max(0, Math.min(Number(input.heavyItems || 0), 20));

  const labor = movers * hours * selectedRate.perHourPerMover;
  const distanceFee = distanceMiles > 20 ? (distanceMiles - 20) * 2.5 : 0;
  const stairsFee = stairs * 25;
  const heavyItemFee = heavyItems * 45;
  const estimatedTotal = Math.round(selectedRate.base + selectedRate.truck + labor + distanceFee + stairsFee + heavyItemFee);

  return {
    serviceType,
    movers,
    hours,
    distanceMiles,
    stairs,
    heavyItems,
    estimatedTotal,
    depositDue: Math.round(estimatedTotal * 0.2)
  };
}

function validateBooking(body) {
  const errors = [];
  const required = ['fullName', 'phone', 'email', 'serviceDate', 'pickupAddress', 'dropoffAddress', 'serviceType'];

  required.forEach(field => {
    if (!cleanString(body[field])) errors.push(`${field} is required`);
  });

  if (body.email && !/^\S+@\S+\.\S+$/.test(body.email)) {
    errors.push('email must be valid');
  }

  return errors;
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MovePro booking API',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/quote', (req, res) => {
  const quote = calculateQuote(req.body || {});
  res.json({ quote });
});

app.post('/api/bookings', async (req, res) => {
  try {
    const body = req.body || {};
    const errors = validateBooking(body);
    if (errors.length) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const quote = calculateQuote(body);
    const now = new Date().toISOString();
    const booking = {
      bookingId: uuidv4(),
      createdAt: now,
      updatedAt: now,
      status: 'REQUESTED',
      fullName: cleanString(body.fullName),
      phone: cleanString(body.phone),
      email: cleanString(body.email).toLowerCase(),
      serviceDate: cleanString(body.serviceDate),
      preferredTime: cleanString(body.preferredTime) || 'Flexible',
      serviceType: quote.serviceType,
      pickupAddress: cleanString(body.pickupAddress),
      dropoffAddress: cleanString(body.dropoffAddress),
      homeSize: cleanString(body.homeSize),
      notes: cleanString(body.notes),
      quote
    };

    await ddb.send(
      new PutCommand({
        TableName: BOOKINGS_TABLE,
        Item: booking,
        ConditionExpression: 'attribute_not_exists(bookingId)'
      })
    );

    res.status(201).json({
      message: 'Booking request received',
      booking
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Could not create booking request' });
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    const data = await ddb.send(
      new ScanCommand({
        TableName: BOOKINGS_TABLE,
        Limit: 50
      })
    );
    const bookings = (data.Items || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ bookings });
  } catch (error) {
    console.error('List bookings error:', error);
    res.status(500).json({ message: 'Could not list bookings' });
  }
});

app.get('/api/bookings/:bookingId', async (req, res) => {
  try {
    const data = await ddb.send(
      new GetCommand({
        TableName: BOOKINGS_TABLE,
        Key: { bookingId: req.params.bookingId }
      })
    );

    if (!data.Item) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking: data.Item });
  } catch (error) {
    console.error('Read booking error:', error);
    res.status(500).json({ message: 'Could not read booking' });
  }
});

app.patch('/api/bookings/:bookingId/status', async (req, res) => {
  try {
    const status = cleanString(req.body.status).toUpperCase();
    const allowed = ['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${allowed.join(', ')}` });
    }

    const data = await ddb.send(
      new UpdateCommand({
        TableName: BOOKINGS_TABLE,
        Key: { bookingId: req.params.bookingId },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': status,
          ':updatedAt': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
      })
    );

    res.json({ booking: data.Attributes });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ message: 'Could not update booking status' });
  }
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MovePro booking API listening on port ${PORT}`);
});
