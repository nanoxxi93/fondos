import mongoose, { Schema, type Model } from "mongoose";

export interface IQuota {
  idFondo: string;
  idSerie: string | null;
  date: Date;
  value: number;
}

const quotaSchema = new Schema<IQuota>(
  {
    idFondo: { type: String, required: true, trim: true },
    idSerie: { type: String, required: false, default: null, trim: true },
    date: { type: Date, required: true },
    value: { type: Number, required: true },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

quotaSchema.index({ idFondo: 1, idSerie: 1, date: 1 }, { unique: true });

/**
 * Obtiene o crea el modelo Mongoose para la colección de cuotas de una fuente dada (ej. "erni", "bbva", "tyba").
 * Mongoose mapea "erni" a la colección "ernis" de forma consistente con el código legado.
 */
export function getQuotaModel(sourceName: string): Model<IQuota> {
  if (mongoose.models[sourceName]) {
    return mongoose.models[sourceName] as Model<IQuota>;
  }
  return mongoose.model<IQuota>(sourceName, quotaSchema);
}

export const ErniQuotaModel = getQuotaModel("erni");
export const BbvaQuotaModel = getQuotaModel("bbva");
