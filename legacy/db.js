"use strict";

import mongoose, { Schema } from "mongoose";

mongoose.Schema.Types.String.checkRequired((v) => typeof v === "string");

const quotaSchema = () => {
  const schema = new Schema({
    idFondo: { type: String, trim: true },
    idSerie: { type: String, trim: true },
    date: { type: Date },
    value: { type: Number },
  });
  schema.index({ idFondo: 1, idSerie: 1, date: 1 }, { unique: true });
  return schema;
};

export const createQuotaModel = (name) => mongoose.model(name, quotaSchema());

const mongoHost = (uri) => {
  try {
    const normalized = uri.replace(/^mongodb(\+srv)?:\/\//, "https://");
    return new URL(normalized).host;
  } catch {
    return "(uri inválida)";
  }
};

mongoose.connection.on("connecting", () => {
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
mongoose.connection.on("connected", () => {
  console.info(
    `Mongoose default connection is open to ${mongoHost(process.env.MONGO_DB_URI)}`
  );
});
mongoose.connection.once("open", () => {
  console.info("MongoDB connection opened!");
});
mongoose.connection.on("reconnected", () => {
  console.info("MongoDB reconnected!");
});
mongoose.connection.on("disconnected", () => {
  console.warn("Mongoose connection disconnected. Attempting to reconnect...");
});

export const mongoInit = async () => {
  const uri = process.env.MONGO_DB_URI;
  if (!uri) {
    throw new Error("MONGO_DB_URI is required");
  }

  await mongoose.connect(uri, {
    serverApi: { version: "1", strict: true, deprecationErrors: true },
    socketTimeoutMS: 60000,
  });
};

export const isMongoReady = () => mongoose.connection.readyState === 1;
