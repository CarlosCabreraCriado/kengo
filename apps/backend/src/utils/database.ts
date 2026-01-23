import mysql from "mysql2";

console.log("Conectando Base de datos: ");
console.log(process.env.MYSQL_PRIVATE_URL);
console.log(process.env.MYSQLUSER);
console.log(process.env.MYSQL_DATABASE);
console.log(process.env.MYSQL_PORT);

var conexion = {
  host: process.env.MYSQL_PRIVATE_URL,
  user: process.env.MYSQLUSER,
  database: process.env.MYSQL_DATABASE,
  password: process.env.MYSQL_ROOT_PASSWORD,
  timezone: "Z",
  port: Number(process.env.MYSQL_PORT),
};

if (process.env.MYSQL_PORT) {
  conexion["port"] = Number(process.env.MYSQL_PORT);
}

const pool = mysql.createPool(conexion);

export default pool.promise();
