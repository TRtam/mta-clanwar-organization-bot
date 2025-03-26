import { Sequelize } from "sequelize";

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: process.env.SQLITE_PATH,
});

export default async function init() {
  try {
    await sequelize.authenticate();
    console.log("Successfully connected to the database.");
  } catch (error) {
    console.log("Unable to connect to the database", error);
  }
}

export { sequelize };
