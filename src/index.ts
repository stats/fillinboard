import express = require('express');
import { Application, Router } from 'express';

import { BASIC_USERS, ADMIN_USERS } from '../users';

import socketIo = require('socket.io');

import { createServer, Server } from 'http';

let app: Application = express();

const basicAuth = require('express-basic-auth');

var clients = {};
var units;

resetUnits();

app.get('/', (req, res) => {
  res.send('<h1>Fillin Board</h1>');
});

app.get('/tool.png', (req, res) => {
  res.sendFile(__dirname + '/client/tool.png');
});

app.get('/fillin-map.png', (req, res) => {
  res.sendFile(__dirname + '/client/fillin-map-v3.png');
});

app.get('/DragDropTouch.js', (req, res) => {
  res.sendFile(__dirname + '/client/DragDropTouch.js');
});

/**
 * Basic Router with User Security
 **/
const router = Router();

router.get('/', (req, res) => {
  res.sendFile(__dirname + '/client/index.html');
});

app.use('/view', basicAuth({
  challenge: true,
  users: BASIC_USERS
}), router);

/**
 * Admin Router with Admin Security
 **/
const admin = Router();
admin.get('/', (req, res) => {
  res.sendFile(__dirname + '/client/edit.html');
});
app.use('/admin', basicAuth({
  challenge: true,
  users: ADMIN_USERS
}), admin);

let http = createServer(app);

let io = socketIo(http);

io.on('connection', (socket) => {
  console.log('a user connected');

  clients[socket.id] = {};

  socket.emit('units', units);

  socket.on('submit-name', (msg) => {
    console.log('Client Submitted Name: ' + msg);
    clients[socket.id].name = msg;
    socket.emit('signed-in', clients[socket.id].name);
    socket.emit('units', units);
    io.sockets.emit('users', clientsToStringArray(clients));
    socket.broadcast.emit('joined', clients[socket.id].name);
  });

  socket.on('change-unit', (msg) => {
    console.log('Client changed a unit', msg);
    let unit = units.find(unit => unit.id === msg.id);
    if(unit) {
      unit.left = msg.left;
      unit.top = msg.top;
    }
    io.sockets.emit('units', units);
    //console.log(JSON.stringify(units));
  });

  socket.on('add-unit', (msg) => {
    console.log('Add unit', msg);
    let unit = units.find(u => u.id === msg.id);
    if(unit != null) return;
    if(msg == null || msg.id == null || msg.id == '') {
      socket.emit('add-error', 'Cannot add a blank unit');
      return;
    }
    units.push(msg);
    io.sockets.emit('units', units);
  });

  socket.on('remove-unit', (msg) => {
    console.log('Remove unit', msg, msg.id);
    units = units.filter(unit => unit.id != msg.id);
    io.sockets.emit('units', units);
  });

  socket.on('reset-units', (msg) => {
    console.log("Reset Units called.");
    resetUnits();
    io.sockets.emit('message', clients[socket.id].name + " has reset all units.");
    io.sockets.emit('units', units);
  });

  socket.on('toggle-on-call', (msg) => {
    let unit = units.find(unit => unit.id === msg.id);
    if(!unit) return;
    if(unit.onCall == null || unit.onCall == false) {
      unit.onCall = true;
    } else {
      unit.onCall = false;
    }
    io.sockets.emit('units', units);
  });

  socket.on('disconnect', () => {
    delete clients[socket.id];
    console.log('user disconnected');
  });
})

http.listen(4199, () => {
  console.log('listening on *:4199');
})

function clientsToStringArray(clients) {
  let a = [];
  for(let client in clients) {
    let c = clients[client];
    if(c.name != null) {
      a.push(c.name);
    }
  }
  return a;
}

function resetUnits() {
  units = [ { id: 'E1', top: 478, left: 299, color: 'black', hasTool: true },
  { id: 'E2', top: 311, left: 242, color: 'black' },
  { id: 'E3', top: 351, left: 99, color: 'black' },
  { id: 'E5', top: 395, left: 151, color: 'black' },
  { id: 'E7', top: 533, left: 156, color: 'black' },
  { id: 'E8', top: 582, left: 327, color: 'black' },
  { id: 'E9', top: 354, left: 377, color: 'black'},
  { id: 'E10', top: 264, left: 151, color: 'black', hasTool: true },
  { id: 'E12', top: 425, left: 440, color: 'black'},
  { id: 'E13', top: 443, left: 191, color: 'black' },
  { id: 'E16', top: 335, left: 301, color: 'black' },
  { id: 'E17', top: 403, left: 278, color: 'black' },
  { id: 'E19', top: 88, left: 223, color: 'black' },
  { id: 'T2', top: 295, left: 150, color: 'red' },
  { id: 'T3', top: 552, left: 230, color: 'red' },
  { id: 'T4', top: 480, left: 401, color: 'red' },
  { id: 'T5', top: 459, left: 107, color: 'red' },
  { id: 'T6', top: 359, left: 301, color: 'red' },
  { id: 'T10', top: 474, left: 189, color: 'red' },
  { id: 'R11', top: 427, left: 278, color: 'blue', hasTool: true } ];
}
