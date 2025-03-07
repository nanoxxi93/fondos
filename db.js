"use strict";

import mongoose from "mongoose";

mongoose.Schema.Types.String.checkRequired((v) => typeof v === "string");

mongoose.connection.on("connecting", function () {
  console.info("connecting to MongoDB...");
});
mongoose.connection.on("error", (err) => {
  if (err.name === "MongoNetworkError") {
    console.error("Network error when connecting to MongoDB:", err.message);
  } else if (err.name === "MongoParseError") {
    console.error("Error parsing connection string to MongoDB:", err.message);
  } else {
    console.error("MongoDB connection error:", err.message);
  }
});
mongoose.connection.on("connected", function () {
  console.info(
    `Mongoose default connection is open to ${
      process.env.MONGO_DB_URI.split("@")[1]
    }`
  );
});
mongoose.connection.once("open", function () {
  console.info("MongoDB connection opened!");
});
mongoose.connection.on("reconnected", function () {
  console.info("MongoDB reconnected!");
});
mongoose.connection.on("disconnected", function () {
  console.warn("Mongoose connection disconnected. Attempting to reconnect...");
});
export const mongoInit = async () => {
  await mongoose.connect(process.env.MONGO_DB_URI, {
    serverApi: { version: "1", strict: true, deprecationErrors: true },
    socketTimeoutMS: 60000,
  });
};
