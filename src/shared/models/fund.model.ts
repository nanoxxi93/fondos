import mongoose, { Schema, type Model } from "mongoose";

export interface IFund {
  idFondo: string;
  source: string;
  name: string;
  currency: "PEN" | "USD";
  risk: number;
  fee: number;
  serie: string;
  updatedAt: Date;
}

const fundSchema = new Schema<IFund>(
  {
    idFondo: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    currency: { type: String, required: true, enum: ["PEN", "USD"] },
    risk: { type: Number, required: true },
    fee: { type: Number, required: true },
    serie: { type: String, required: true, trim: true },
    updatedAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "funds",
  }
);

fundSchema.index({ idFondo: 1, source: 1 }, { unique: true });

export function getFundModel(): Model<IFund> {
  const modelName = "Fund";
  if (mongoose.models[modelName]) {
    return mongoose.models[modelName] as Model<IFund>;
  }
  return mongoose.model<IFund>(modelName, fundSchema);
}

export const FundModel = getFundModel();
