import express from 'express';
import logger from 'morgan';
import dotenv from 'dotenv';
import mysql from 'mysql';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 3000;

const app = express();
const server = createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {}
});

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'turso'
});

db.connect(err => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log('Connected to database');
});

io.on('connection', async (socket) => {
  console.log('A user has connected!');

  socket.on('disconnect', () => {
    console.log('A user has disconnected');
  });

  socket.on('chat message', async (msg) => {
    const username = socket.handshake.auth.username || 'anonymous';
    console.log({ username });

    const insertQuery = 'INSERT INTO messages (content, user) VALUES (?, ?)';
    db.query(insertQuery, [msg, username], (err, result) => {
      if (err) {
        console.error('Error inserting message:', err);
        return;
      }
      const insertedId = result.insertId;
      io.emit('chat message', msg, insertedId, username);
    });
  });

  if (!socket.recovered) { // Recover messages for offline users
    const selectQuery = 'SELECT id, content, user FROM messages WHERE id > ?';
    db.query(selectQuery, [socket.handshake.auth.serverOffset || 0], (err, results) => {
      if (err) {
        console.error('Error retrieving messages:', err);
        return;
      }
      results.forEach(row => {
        socket.emit('chat message', row.content, row.id, row.user);
      });
    });
  }
});

app.use(logger('dev'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
