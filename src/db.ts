if (!process.env.ONE_TABLE) {
  throw new Error("ONE_TABLE env variable is not set");
}
export const TableName = process.env.ONE_TABLE;
