import express = require("express");
import { Application, Router } from "express";

import socketIo = require("socket.io");

import * as http from "http";
import * as fs from "fs";

const PORT = process.env.PORT || 3001;
const SSO_ENTRY_POINT = process.env.ENTRY_POINT;
const SSO_ISSUER = process.env.ISSUER;
const SSO_APP_CERT = process.env.SSO_CERT;
const SSO_CLAIM_USER = process.env.SSO_CLAIM_USER;
const SSO_CLAIM_ADMIN = process.env.SSO_CLAIM_ADMIN;

var moment = require("moment-timezone");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
var passport = require("passport");
var session = require("express-session");

let app: Application = express();

var SamlStrategy = require("passport-saml").Strategy;
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});
passport.use(
  new SamlStrategy(
    {
      path: "/login/callback",
      protocol: "https",
      entryPoint: SSO_ENTRY_POINT,
      issuer: SSO_ISSUER,
      cert: fs.readFileSync(SSO_APP_CERT, "utf-8"),
      signatureAlgorithm: "sha256",
    },
    function (profile, done) {
      let claims =
        profile["attributes"][
          "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups"
        ];
      let isUser = claims.includes(SSO_CLAIM_USER);
      let isAdmin = claims.includes(SSO_CLAIM_ADMIN);
      return done(null, {
        id: profile["nameID"],
        displayName: profile["DisplayName"],
        isUser: isUser,
        isAdmin: isAdmin,
      });
    }
  )
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

var sessionMiddleware = session({
  resave: true,
  saveUninitialized: true,
  secret: "Secret for RFD",
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

function defaultTitle() {
  return [
    {
      user: "system",
      text: "On Current Alarm",
      date: moment().tz("America/New_York").format("MM/DD/YY HH:mm:ss"),
    },
    {
      user: "system",
      text: "On Second Alarm",
      date: moment().tz("America/New_York").format("MM/DD/YY HH:mm:ss"),
    },
    {
      user: "system",
      text: "Out of Service",
      date: moment().tz("America/New_York").format("MM/DD/YY HH:mm:ss"),
    },
  ];
}

var clients = {};
var units = [];
var titles = defaultTitle();
var messages = [];

resetUnits();

app.get(
  "/login",
  passport.authenticate("saml", {
    successRedirect: "/access",
    failureRedirect: "/failure",
  })
);
app.post(
  "/login/callback",
  passport.authenticate("saml", {
    failureRedirect: "/failure",
    failureFlash: true,
  }),
  function (req, res) {
    //@ts-ignore
    if (req.user.isAdmin) {
      res.redirect("/admin");
      //@ts-ignore
    } else if (req.user.isUser) {
      res.redirect("/view");
    } else {
      res.redirect("/failure");
    }
  }
);

app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/access", (req, res) => {
  if (req.isAuthenticated()) {
    //@ts-ignore
    if (req.user.isAdmin) {
      res.redirect("/admin");
      //@ts-ignore
    } else if (req.user.isUser) {
      res.redirect("/view");
    } else {
      res.redirect("/failure");
    }
  }
});

app.get("/failure", (req, res) => {
  res.status(403);
  res.render("Forbidden", {
    error: "You are not authorized to access this application.",
  });
});

app.get("/tool.png", (req, res) => {
  res.sendFile(__dirname + "/client/tool.png");
});

app.get("/style.css", (req, res) => {
  res.sendFile(__dirname + "/client/style.css");
});

app.get("/fillin-map.png", (req, res) => {
  res.sendFile(__dirname + "/client/fillin-map-v7.png");
});

app.get("/DragDropTouch.js", (req, res) => {
  res.sendFile(__dirname + "/client/DragDropTouch.js");
});

app.get("/view", (req, res) => {
  //@ts-ignore
  if (req.isAuthenticated() && req.user.isUser)
    res.sendFile(__dirname + "/client/index.html");
  else res.redirect("/");
});

app.get("/admin", (req, res) => {
  //@ts-ignore
  if (req.isAuthenticated() && req.user.isAdmin) {
    console.log("We are authenticated");
    res.sendFile(__dirname + "/client/edit.html");
  } else {
    console.log("We are not authenticated");
    res.redirect("/");
  }
});

let server = http.createServer(app);

let io = socketIo(server);

// convert a connect middleware to a Socket.IO middleware
const wrap = (middleware) => (socket, next) =>
  middleware(socket.request, {}, next);

io.use(wrap(sessionMiddleware));

io.on("connection", (socket) => {
  clients[socket.id] = {};

  var passport_name = socket.request.session.passport.user.displayName;

  console.log("a user connected ", passport_name);
  clients[socket.id].name = passport_name;
  socket.emit("signed-in", clients[socket.id].name);
  socket.emit("units", units);
  socket.emit("set-titles", titles);
  socket.emit("recent-chat", messages);
  io.sockets.emit("users", clientsToStringArray(clients));
  socket.broadcast.emit("joined", clients[socket.id].name);

  socket.on("chat", (msg) => {
    let message = {
      user: clients[socket.id].name,
      text: msg,
      date: moment().tz("America/New_York").format("MM/DD/YY HH:mm:ss"),
    };
    messages.push(message);
    if (messages.length > 50) {
      messages.shift();
    }
    io.sockets.emit("chat", message);
  });

  socket.on("set-titles", (msg) => {
    titles = [];
    for (let t of msg) {
      titles.push({
        user: clients[socket.id].name,
        text: t,
        date: moment().tz("America/New_York").format("MM/DD/YY HH:mm:ss"),
      });
    }
    io.sockets.emit("set-titles", titles);
  });

  socket.on("change-unit", (msg) => {
    console.log("Client changed a unit", msg);
    let unit = units.find((unit) => unit.id === msg.id);
    if (unit) {
      unit.left = msg.left;
      unit.top = msg.top;
    }
    io.sockets.emit("units", units);
  });

  socket.on("add-unit", (msg) => {
    console.log("Add unit", msg);
    let unit = units.find((u) => u.id === msg.id);
    if (unit != null) return;
    if (msg == null || msg.id == null || msg.id == "") {
      socket.emit("add-error", "Cannot add a blank unit");
      return;
    }
    units.push(msg);
    io.sockets.emit("units", units);
  });

  socket.on("remove-unit", (msg) => {
    console.log("Remove unit", msg, msg.id);
    units = units.filter((unit) => unit.id != msg.id);
    io.sockets.emit("units", units);
  });

  socket.on("reset-units", (msg) => {
    console.log("Reset Units called.");
    resetUnits();
    titles = defaultTitle();
    io.sockets.emit(
      "message",
      clients[socket.id].name + " has reset all units."
    );
    io.sockets.emit("units", units);
    io.sockets.emit("set-titles", titles);
  });

  socket.on("toggle-on-call", (msg) => {
    let unit = units.find((unit) => unit.id === msg.id);
    if (!unit) return;
    if (unit.onCall == null || unit.onCall == false) {
      unit.onCall = true;
    } else {
      unit.onCall = false;
    }
    io.sockets.emit("units", units);
  });

  socket.on("disconnect", () => {
    delete clients[socket.id];
    io.sockets.emit("users", clientsToStringArray(clients));
    console.log("user disconnected");
  });
});

server.listen(PORT, () => {
  console.log("listening on " + PORT);
});

function clientsToStringArray(clients) {
  let a = [];
  for (let client in clients) {
    let c = clients[client];
    if (c.name != null) {
      a.push(c.name);
    }
  }
  return a;
}

function resetUnits() {
  units = [
    { id: "E1", top: 475, left: 329, color: "black", hasTool: true },
    { id: "E2", top: 318, left: 274, color: "black" },
    { id: "E3", top: 361, left: 125, color: "black" },
    { id: "E5", top: 400, left: 180, color: "black" },
    { id: "E7", top: 536, left: 185, color: "black" },
    { id: "E33", top: 579, left: 258, color: "black" },
    { id: "E9", top: 366, left: 406, color: "black" },
    { id: "E10", top: 272, left: 180, color: "black", hasTool: true },
    { id: "E12", top: 424, left: 464, color: "black" },
    { id: "E13", top: 443, left: 217, color: "black" },
    { id: "E16", top: 340, left: 323, color: "black" },
    { id: "E17", top: 402, left: 315, color: "black" },
    { id: "E19", top: 95, left: 254, color: "black" },
    { id: "T2", top: 299, left: 179, color: "red" },
    { id: "T3", top: 552, left: 258, color: "red" },
    { id: "T4", top: 479, left: 427, color: "red" },
    { id: "T5", top: 464, left: 132, color: "red" },
    { id: "T6", top: 369, left: 322, color: "red" },
    { id: "T10", top: 470, left: 216, color: "red" },
    { id: "R11", top: 429, left: 313, color: "blue", hasTool: true },
  ];
}
