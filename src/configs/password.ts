import bcrypt from "bcrypt";

const saltRounds = 10;

const bcryptPassword = (plainText: string) => {
  const hash = bcrypt.hash(plainText, saltRounds);
  return hash;
};
const comparePassword = (plainText: string, bcryptPassword: string) => {
  return bcrypt.compare(plainText, bcryptPassword);
};

export { bcryptPassword, comparePassword };
