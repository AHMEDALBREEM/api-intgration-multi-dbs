
const express = require('express');
const mysql = require('mysql2');
const sqlite3 = require('sqlite3').verbose();
const mongoose = require('mongoose');
const { Pool } = require('pg'); // Import PostgreSQL client
const rateLimit = require('express-rate-limit');
const axios = require('axios');


// Create a rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});

// Apply the rate limiter to all requests
const app = express();
const port = 3000;

// Middleware to parse JSON request bodies
app.use(express.json(),limiter);


const pgPool = new Pool({
  user: 'postgres',        // Replace with your PostgreSQL username
  host: 'localhost',           // Replace with your PostgreSQL host
  database: 'testdb',          // Replace with your PostgreSQL database name
  password: 'Root@2023', // Replace with your PostgreSQL password
  port: 5432,                  // Default PostgreSQL port
});

// MongoDB connection setup
mongoose.connect('mongodb://127.0.0.1:27017/testdb');
const mongoUserSchema = new mongoose.Schema({
  name: String,
  email: String
});
const MongoUser = mongoose.model('User', mongoUserSchema);

// MySQL connection setup
const mysqlConnection = mysql.createConnection({
  host: 'localhost',   // Replace with your MySQL host
  user: 'root',        // Replace with your MySQL username
  password: 'Root@2023',        // Replace with your MySQL password
  database: 'testdb',  // Replace with your MySQL database name
});

// SQLite connection setup
const sqliteConnection = new sqlite3.Database('test.db');

const ALLOWED_IP = "103.82.173.152";

app.use(async (req, res, next) => {
  try {
    // Get the client's IP address
    let clientIp = req.headers['x-forwarded-for'] || req.ip;

    // Normalize the IP address (remove port number, etc.)
    if (clientIp.includes(',')) {
      clientIp = clientIp.split(',')[0].trim(); // Take the first IP in x-forwarded-for
    }
    clientIp = clientIp.replace(/^::ffff:/, ''); // Handle IPv4-mapped IPv6 addresses

    // Fetch IP info from ipinfo.io
    const response = await axios.get(`https://ipinfo.io/${clientIp}?token=04280a9cb8a2af`);
    const ipInfo = response.data;

    // Log IP info for debugging
    console.log('IP Info:', ipInfo);

    // Validate the IP address
    if (clientIp !== ALLOWED_IP) {
      return res.status(403).send({
        success: false,
        error: `Access denied: Invalid IP address - ${clientIp}`,
        location: ipInfo.city || 'Unknown location',
        region: ipInfo.region || 'Unknown region',
        country: ipInfo.country || 'Unknown country',
      });
    }

    // If the IP is allowed, proceed to the next middleware or route
    next();
  } catch (err) {
    console.error('Error fetching IP info:', err.message);
    res.status(500).send({ success: false, error: 'Internal Server Error' });
  }
});


// Route for `/info` for all databases (MySQL, SQLite, MongoDB)
app.get('/:db/', async (req, res) => {
  const { db } = req.params; // Get database type from URL (mysql, sqlite, mongo, or all)

  try {
    if (db === 'postgres') {
      try {
        const result = await pgPool.query('SELECT * FROM users');
        res.status(200).send(result.rows); // Send the results as JSON response
      } catch (err) {
        console.error('Postgres Fetch Error:', err);
        res.status(500).send({ success: false, error: 'Error fetching users from PostgreSQL' });
      }
    } 
    else if (db === 'mysql') {
      try {
        mysqlConnection.query('SELECT * FROM users', (err, results) => {
          if (err) {
            console.error('MySQL Fetch Error:', err);
            res.status(500).send({ success: false, error: 'Error fetching users from MySQL' });
          } else {
            res.status(200).send(results); // Send the results as JSON response
          }
        });
      } catch (err) {
        console.error('MySQL Fetch Error:', err);
        res.status(500).send({ success: false, error: 'Error fetching users from MySQL' });
      }
    } 
    else if (db === 'sqlite') {
      try {
        sqliteConnection.all('SELECT * FROM users', [], (err, rows) => {
          if (err) {
            console.error('SQLite Fetch Error:', err);
            res.status(500).send({ success: false, error: 'Error fetching users from SQLite' });
          } else {
            res.status(200).send(rows); // Send the rows as JSON response
          }
        });
      } catch (err) {
        console.error('SQLite Fetch Error:', err);
        res.status(500).send({ success: false, error: 'Error fetching users from SQLite' });
      }
    } 
    else if (db === 'mongo') {
      try {
        // Fetch users from MongoDB without using Promise
        const users = await MongoUser.find({});
        
        // Send a structured response
        res.status(200).send({ data: users });
      } catch (err) {
        // Log the error for debugging
        console.error('MongoDB Fetch Error:', err);

        // Send a structured error response
        res.status(500).send({ success: false, error: 'Error fetching users from MongoDB' });
      }
    } 
    else if (db === 'all') {
      try {
        const mysqlResults = await new Promise((resolve, reject) => {
          mysqlConnection.query('SELECT * FROM users', (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });

        const sqliteResults = await new Promise((resolve, reject) => {
          sqliteConnection.all('SELECT * FROM users', [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });

        const mongoResults = await MongoUser.find({});

        const pgResults = await pgPool.query('SELECT * FROM users');

        res.status(200).send({
          mysql: mysqlResults,
          sqlite: sqliteResults,
          mongo: mongoResults,
          postgres: pgResults.rows // Include PostgreSQL results in the response
        });
      } catch (err) {
        res.status(500).send({ error: 'Error fetching users from multiple databases' });
      }
    } 
    else {
      res.status(400).send({ error: 'Unsupported database' });
    }
  } catch (err) {
    res.status(500).send({ error: 'Error fetching users from the database' });
  }
});


// Insert a new user into the specified database (MySQL, SQLite, or MongoDB)
app.get('/:db/insert/:name/:email', (req, res) => {
  const { db, name, email } = req.params; // Get database type, name, and email from URL

  // Validate incoming data (optional)
  if (!name || !email) {
    return res.status(400).send({ error: 'Name and Email are required' });
  }


  if (db === 'postgres') {
    pgPool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id',
      [name, email],
      (err, result) => {
        if (err) {
          return res.status(500).send({ error: 'Error inserting user into PostgreSQL' });
        }
        res.status(201).send({ id: result.rows[0].id, name, email });
      }
    );
  }
  else if (db === 'mysql') {
    mysqlConnection.query(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [name, email],
      (err, results) => {
        if (err) {
          return res.status(500).send({ error: 'Error inserting user into MySQL' });
        }
        res.status(201).send({ id: results.insertId, name, email });
      }
    );
  } else if (db === 'sqlite') {
    sqliteConnection.run(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [name, email],
      function (err) {
        if (err) {
          return res.status(500).send({ error: 'Error inserting user into SQLite' });
        }
        res.status(201).send({ id: this.lastID, name, email });
      }
    );
  } else if (db === 'mongo') {
    // Insert into MongoDB
    const newUser = new MongoUser({ name, email });
    newUser .save()
      .then(user => {
        res.status(201).send({ id: user._id, name, email });
      })
      .catch(err => {
        return res.status(500).send({ error: 'Error inserting user into MongoDB' });
      });
  }  else {
    return res.status(400).send({ error: 'Unsupported insertion database' });
  }
});

app.get('/:db/update/:id/:name/:email', (req, res) => {
  const { db, id, name, email } = req.params;

  // Validate incoming data
  if (!name || !email) {
    return res.status(400).send({ error: 'Name and Email are required' });
  }

  if (db === 'postgres') {
    pgPool.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id',
      [name, email, id],
      (err, result) => {
        if (err) {
          return res.status(500).send({ error: 'Error updating user in PostgreSQL' });
        }
        if (result.rowCount === 0) {
          return res.status(404).send({ error: 'User not found' });
        }
        res.status(200).send({ id: result.rows[0].id, name, email });
      }
    );
  }
  else if (db === 'mysql') {
    mysqlConnection.query(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, id],
      (err, results) => {
        if (err) {
          return res.status(500).send({ error: 'Error updating user in MySQL' });
        }
        if (results.affectedRows === 0) {
          return res.status(404).send({ error: 'User not found' });
        }
        res.status(200).send({ id, name, email });
      }
    );
  } else if (db === 'sqlite') {
    sqliteConnection.run(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, id],
      function (err) {
        if (err) {
          return res.status(500).send({ error: 'Error updating user in SQLite' });
        }
        if (this.changes === 0) {
          return res.status(404).send({ error: 'User not found' });
        }
        res.status(200).send({ id, name, email });
      }
    );
  } else if (db === 'mongo') {
    MongoUser.findByIdAndUpdate(id, { name, email }, { new: true })
      .then(user => {
        if (!user) {
          return res.status(404).send({ error: 'User not found' });
        }
        res.status(200).send({ id: user._id, name, email });
      })
      .catch(err => {
        return res.status(500).send({ error: 'Error updating user in MongoDB' });
      });
  } else {
    return res.status(400).send({ error: 'Unsupported update database' });
  }
});


// Delete a user in the specified database (PostgreSQL, MySQL, SQLite, MongoDB)
app.get('/:db/delete/:id', (req, res) => {
  const { db, id } = req.params;

  if (db === 'postgres') {
    pgPool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id],
      (err, result) => {
        if (err) {
          return res.status(500).send({ error: 'Error deleting user from PostgreSQL' });
        }
        if (result.rowCount === 0) {
          return res.status(404).send({ error: 'User not found' });
        }
        res.status(200).send({ message: 'User deleted successfully', id });
      }
    );
  }
  else if (db === 'mysql') {
    mysqlConnection.query(
      'DELETE FROM users WHERE id = ?',
      [id],
      (err, results) => {
        if (err) {
          return res.status(500).send({ error: 'Error deleting user from MySQL' });
        }
        if (results.affectedRows === 0) {
          return res.status(404).send({ error: 'User not found' });
        }
        res.status(200).send({ message: 'User deleted successfully', id });
      }
    );
  } else if (db === 'sqlite') {
    sqliteConnection.run(
      'DELETE FROM users WHERE id = ?',
      [id],
      function (err) {
        if (err) {
          return res.status(500).send({ error: 'Error deleting user from SQLite' });
        }
        if (this.changes === 0) {
          return res.status(404).send({ error: 'User not found' });
        }
        res.status(200).send({ message: 'User deleted successfully', id });
      }
    );
  } else if (db === 'mongo') {
    MongoUser.findByIdAndDelete(id)
      .then(user => {
        if (!user) {
          return res.status(404).send({ error: 'User not found' });
        }
        res.status(200).send({ message: 'User deleted successfully', id: user._id });
      })
      .catch(err => {
        return res.status(500).send({ error: 'Error deleting user from MongoDB' });
      });
  } else {
    return res.status(400).send({ error: 'Unsupported delete database' });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Route for the root URL
app.get('/', (req, res) => {
  res.status(200).send(
    {
      "message": "Welcome to the User API!",
      "description": "This API allows you to interact with user data stored in MySQL, SQLite, MongoDB, and PostgreSQL databases.",
      "availableEndpoints": {
        "fetchUsers": {
          "description": "Fetch all users from the specified database.",
          "endpoints": {
            "mysql": {
              "url": "/mysql",
              "method": "GET",
              "example": "GET /mysql",
              "response": "Returns a list of users from the MySQL database."
            },
            "sqlite": {
              "url": "/sqlite",
              "method": "GET",
              "example": "GET /sqlite",
              "response": "Returns a list of users from the SQLite database."
            },
            "mongo": {
              "url": "/mongo",
              "method": "GET",
              "example": "GET /mongo",
              "response": "Returns a list of users from the MongoDB database."
            },
            "postgres": {
              "url": "/postgres",
              "method": "GET",
              "example": "GET /postgres",
              "response": "Returns a list of users from the PostgreSQL database."
            },
            "all": {
              "url": "/all",
              "method": "GET",
              "example": "GET /all",
              "response": "Returns a list of users from MySQL, SQLite, MongoDB, and PostgreSQL databases."
            }
          }
        },
        "insert": {
          "description": "Insert a new user into the specified database.",
          "endpoints": {
            "mysql": {
              "url": "/mysql/insert/:name/:email",
              "method": "GET",
              "example": "GET /mysql/insert/JohnDoe/johndoe@example.com",
              "response": "Inserts a new user into the MySQL database and returns the inserted user data."
            },
            "sqlite": {
              "url": "/sqlite/insert/:name/:email",
              "method": "GET",
              "example": "GET /sqlite/insert/JaneDoe/janedoe@example.com",
              "response": "Inserts a new user into the SQLite database and returns the inserted user data."
            },
            "mongo": {
              "url": "/mongo/insert/:name/:email",
              "method": "GET",
              "example": "GET /mongo/insert/JohnDoe/johndoe@example.com",
              "response": "Inserts a new user into the MongoDB database and returns the inserted user data."
            },
            "postgres": {
              "url": "/postgres/insert/:name/:email",
              "method": "GET",
              "example": "GET /postgres/insert/JohnDoe/johndoe@example.com",
              "response": "Inserts a new user into the PostgreSQL database and returns the inserted user data."
            }
          }
        },
        "update": {
          "description": "Update an existing user in the specified database.",
          "endpoints": {
            "mysql": {
              "url": "/mysql/update/:id/:name/:email",
              "method": "GET",
              "example": "GET /mysql/update/1/JohnDoe/johndoe@example.com",
              "response": "Updates the user in the MySQL database and returns the updated user data."
            },
            "sqlite": {
              "url": "/sqlite/update/:id/:name/:email",
              "method": "GET",
              "example": "GET /sqlite/update/1/JaneDoe/janedoe@example.com",
              "response": "Updates the user in the SQLite database and returns the updated user data."
            },
            "mongo": {
              "url": "/mongo/update/:id/:name/:email",
              "method": "GET",
              "example": "GET /mongo/update/605c72ef1532074e041b44e8/JohnDoe/johndoe@example.com",
              "response": "Updates the user in the MongoDB database and returns the updated user data."
            },
            "postgres": {
              "url": "/postgres/update/:id/:name/:email",
              "method": "GET",
              "example": "GET /postgres/update/1/JohnDoe/johndoe@example.com",
              "response": "Updates the user in the PostgreSQL database and returns the updated user data."
            }
          }
        },
        "delete": {
          "description": "Delete a user from the specified database.",
          "endpoints": {
            "mysql": {
              "url": "/mysql/delete/:id",
              "method": "GET",
              "example": "GET /mysql/delete/1",
              "response": "Deletes the user from the MySQL database and returns a success message."
            },
            "sqlite": {
              "url": "/sqlite/delete/:id",
              "method": "GET",
              "example": "GET /sqlite/delete/1",
              "response": "Deletes the user from the SQLite database and returns a success message."
            },
            "mongo": {
              "url": "/mongo/delete/:id",
              "method": "GET",
              "example": "GET /mongo/delete/605c72ef1532074e041b44e8",
              "response": "Deletes the user from the MongoDB database and returns a success message."
            },
            "postgres": {
              "url": "/postgres/delete/:id",
              "method": "GET",
              "example": "GET /postgres/delete/1",
              "response": "Deletes the user from the PostgreSQL database and returns a success message."
            }
          }
        }
      },
      "note": "Make sure to replace :name, :email, and :id with actual values when inserting, updating, or deleting a user."
    }
    
  
  );
});