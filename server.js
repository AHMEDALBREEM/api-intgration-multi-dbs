
const express = require('express');
const mysql = require('mysql2');
const sqlite3 = require('sqlite3').verbose();
const mongoose = require('mongoose');
const { Pool } = require('pg'); // Import PostgreSQL client
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');


// Create a rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});

// Apply the rate limiter to all requests
const app = express();
const port = 3000;

// Middleware to parse JSON request bodies
app.use(express.json(),limiter,cors(),express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  next();
});

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

const tokenSchema = new mongoose.Schema({
  ip: String,  // IP address
  client_token: String // Authentication token
});

// Create a model for the tokens collection
const MongoToken = mongoose.model('Token', tokenSchema);

// MySQL connection setup
const mysqlConnection = mysql.createConnection({
  host: 'localhost',   // Replace with your MySQL host
  user: 'root',        // Replace with your MySQL username
  password: 'Root@2023',        // Replace with your MySQL password
  database: 'testdb',  // Replace with your MySQL database name
});

// SQLite connection setup
const sqliteConnection = new sqlite3.Database('test.db');

// router ip distrubtutor and port assigned ip direct to pc
const ALLOWED_IP = ["103.82.173.154","103.82.173.160","103.82.173.154","103.82.173.150","103.82.173.159"];
const SECRET_KEY = crypto.randomBytes(32).toString('base64url');  

app.get('/generate-token/:dbtype', async (req, res) => {
  try {
    // Extract dbType from the URL
    const { dbtype } = req.params;

    // Fetch IP info from ipinfo.io
    const response = await axios.get(`https://ipinfo.io/?token=04280a9cb8a2af`);
    const ipInfo = response.data;

    // Get the client's IP address
    const clientIp = ipInfo.ip;

    // Validate the IP address
    if (!ALLOWED_IP.includes(clientIp)) {
      return res.status(403).send({
        success: false,
        error: `Access denied: Invalid IP address - ${clientIp}`,
        location: ipInfo.city || 'Unknown location',
        region: ipInfo.region || 'Unknown region',
        country: ipInfo.country || 'Unknown country',
      });
    }

    // Generate a token
    const token = generateToken(clientIp);

    // Handle database insertion based on dbType
    switch (dbtype.toLowerCase()) {
      case 'mysql':
        mysqlConnection.query(
          'INSERT INTO tokens (ip, token) VALUES (?, ?)',
          [clientIp, token],
          (err, result) => {
            if (err) {
              return res.status(500).send({ success: false, error: err.message });
            }
            res.status(200).send({
              success: true,
              token: token,
              message: 'Token generated and inserted into MySQL successfully',
            });
          }
        );
        break;

      case 'mongo':
        const mongoToken = new MongoToken({ ip: clientIp, client_token: token }); // Replace 'email' with token for simplicity
        await mongoToken.save();
        res.status(200).send({
          success: true,
          token: token,
          message: 'Token generated and inserted into MongoDB successfully',
        });
        break;

      case 'postgres':
        await pgPool.query('INSERT INTO tokens (ip, token) VALUES ($1, $2)', [clientIp, token]);
        res.status(200).send({
          success: true,
          token: token,
          message: 'Token generated and inserted into PostgreSQL successfully',
        });
        break;

      case 'sqlite':
        sqliteConnection.run('INSERT INTO tokens (ip, token) VALUES (?, ?)', [clientIp, token], function (err) {
          if (err) {
            return res.status(500).send({ success: false, error: err.message });
          }
          res.status(200).send({
            success: true,
            token: token,
            message: 'Token generated and inserted into SQLite successfully',
          });
        });
        break;

      default:
        res.status(400).send({ success: false, error: 'Invalid database type provided' });
    }
  } catch (err) {
    console.error('Error generating token:', err.message);
    res.status(500).send({ success: false, error: 'Internal Server Error' });
  }
});


// Function to generate a token (placeholder implementation)
const generateToken = ip => crypto.createHmac('sha256', SECRET_KEY).update(ip).digest('base64url').substring(0, 22);

// Route for `/info` for all databases (MySQL, SQLite, MongoDB)
app.get('/:db/', async (req, res) => {
  const { db } = req.params; // Get database type from URL (mysql, sqlite, mongo, or all)

  const referer = req.get('Referer');
  const allowedReferer = 'http://localhost:3000/'; // Adjust this if your index.html is served from a different location

  // Check if the referer is allowed
  if (!referer || !referer.startsWith(allowedReferer)) {
    // spascial services free-orgin inside the referer
    if(db !== 'doce' && db !== 'generate-token'){
    return res.status(403).send({ error: 'Access denied: Misuse of API (Under Restrcturing)(Machine is saying : Multi-Attempt will block you)' });
  }
}


  try {
    if (db === 'postgres') {
      const result = await fetchFromPostgres();
      res.status(200).send(result.data);
    } 
    else if (db === 'mysql') {
      const result = await fetchFromMySQL();
      res.status(200).send(result.data);
    } 
    else if (db === 'sqlite') {
      const result = await fetchFromSQLite();
      res.status(200).send(result.data);
    } 
    else if (db === 'mongo') {
      const result = await fetchFromMongo();
      res.status(200).send(result.data);
    } 
    else if (db === 'all') {
      try {
// Fetch users from all databases 
const [mysqlResults, sqliteResults, mongoResults, pgResults] = await Promise.all([
  fetchFromMySQL(),
  fetchFromSQLite(),
  fetchFromMongo(),
  fetchFromPostgres(),
]);

res.status(200).send({
  mysql: mysqlResults.data,
  sqlite: sqliteResults.data,
  mongo: mongoResults.data,
  postgres: pgResults.data,
});
      } catch (err) {
        res.status(500).send({ error: 'Error fetching users from multiple databases' });
      }
    } 
    else if (db === 'doce') {
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
    }
    else if (db === 'generate-token'){
      res.status(400).send({ success: false, error: 'Invalid database type provided try with one of the following: mysql, sqlite, mongo, postgres example http://localhost:3000/generate-token/mongo' });
    }
  } catch (err) {
    res.status(500).send({ error: 'Error fetching users from the database' });
  }
});

// Insert a new user into the specified database (MySQL, SQLite, or MongoDB)
app.get('/:db/insert/:name/:email', (req, res) => {
  const { db, name, email } = req.params; // Get database type, name, and email from URL
  const referer = req.get('Referer');
  const allowedReferer = 'http://localhost:3000/'; // Adjust this if your index.html is served from a different location

  // Check if the referer is allowed
  if (!referer || !referer.startsWith(allowedReferer)) {
    return res.status(403).send({ error: 'Access denied: Invalid referer' });
  }

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
  const referer = req.get('Referer');
  const allowedReferer = 'http://localhost:3000/'; // Adjust this if your index.html is served from a different location

  // Check if the referer is allowed
  if (!referer || !referer.startsWith(allowedReferer)) {
    return res.status(403).send({ error: 'Access denied: Invalid referer' });
  }

  // Validate incoming data
  if (!name || !email) {
    return res.status(400).send({ error: 'Name and Email are required' });
  }
  if (db === 'postgres') {
    updateInPostgres(id, name, email, res);
  } else if (db === 'mysql') {
    updateInMySQL(id, name, email, res);
  } else if (db === 'sqlite') {
    updateInSQLite(id, name, email, res);
  } else if (db === 'mongo') {
    updateInMongo(id, name, email, res);
  } else {
    res.status(400).send({ error: 'Unsupported update database' });
  }
 
});

// Delete a user in the specified database (PostgreSQL, MySQL, SQLite, MongoDB)
app.get('/:db/delete/:id', (req, res) => {
  const { db, id } = req.params;
  const referer = req.get('Referer');
  const allowedReferer = 'http://localhost:3000/'; // Adjust this if your index.html is served from a different location

  // Check if the referer is allowed
  if (!referer || !referer.startsWith(allowedReferer)) {
    return res.status(403).send({ error: 'Access denied: Invalid referer' });
  }

  if (db === 'postgres') {
    deleteFromPostgres(id, res);
  } else if (db === 'mysql') {
    deleteFromMySQL(id, res);
  } else if (db === 'sqlite') {
    deleteFromSQLite(id, res);
  } else if (db === 'mongo') {
    deleteFromMongo(id, res);
  } else {
    res.status(400).send({ error: 'Unsupported delete database' });
  }


});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.get('/api-key=:token/fetch', async (req, res) => {
    const { token } = req.params; // Extract the token from the URL
  
    // Validate the token
    if (!token) {
      return res.status(400).send({ error: 'Token is required' });
    }
  
    // Check the token for each database type
    const tokenCheckPostgres = await searchToken('postgres', token);
    const tokenCheckMySQL = await searchToken('mysql', token);
    const tokenCheckSQLite = await searchToken('sqlite', token);
    const tokenCheckMongo = await searchToken('mongo', token);
  
    // Fetch data from the appropriate database based on the token
    if (tokenCheckPostgres.success) {
      const data = await fetchFromPostgres(res);
      return res.status(200).send(data);
    } else if (tokenCheckMySQL.success) {
      const data = await fetchFromMySQL(res);
      return res.status(200).send(data);
    } else if (tokenCheckSQLite.success) {
      const data = await fetchFromSQLite(res);
      return res.status(200).send(data);
    } else if (tokenCheckMongo.success) {
      const data = await fetchFromMongo(res);
      return res.status(200).send(data);
    } else {
      return res.status(400).send({ error: 'Unsupported database or invalid token!' });
    }
  });


app.get('/api-key=:token/delete/:id', async (req, res) => {
  const { id, token } = req.params;

  // Validate parameters
  if (!id) {
    return res.status(400).send({ error: 'ID is required' });
  }

  // Check the token for each database type
  const tokenCheckPostgres = await searchToken('postgres', token);
  const tokenCheckMySQL = await searchToken('mysql', token);
  const tokenCheckSQLite = await searchToken('sqlite', token);
  const tokenCheckMongo = await searchToken('mongo', token);

  // Delete data from the appropriate database based on the token
  if (tokenCheckPostgres.success) {
    deleteFromPostgres(id, res);
  } else if (tokenCheckMySQL.success) {
    deleteFromMySQL(id, res);
  } else if (tokenCheckSQLite.success) {
    deleteFromSQLite(id, res);
  } else if (tokenCheckMongo.success) {
    deleteFromMongo(id, res);
  } else {
    res.status(400).send({ error: 'Unsupported delete database or Unsupported Token!' });
  }
});

app.get('/api-key=:token/insert/:name/:email', async (req, res) => {
  const { name, email, token } = req.params;

  // Validate parameters
  if (!name || !email) {
    return res.status(400).send({ error: 'Name and Email are required' });
  }

  // Check the token for each database type
  const tokenCheckPostgres = await searchToken('postgres', token);
  const tokenCheckMySQL = await searchToken('mysql', token);
  const tokenCheckSQLite = await searchToken('sqlite', token);
  const tokenCheckMongo = await searchToken('mongo', token);

  // Insert data into the appropriate database based on the token
  if (tokenCheckPostgres.success) {
    insertIntoPostgres(name, email, res);
  } else if (tokenCheckMySQL.success) {
    insertIntoMySQL(name, email, res);
  } else if (tokenCheckSQLite.success) {
    insertIntoSQLite(name, email, res);
  } else if (tokenCheckMongo.success) {
    insertIntoMongo(name, email, res);
  } else {
    res.status(400).send({ error: 'Unsupported insert database or Unsupported Token!' });
  }
});

app.get('/api-key=:token/update/:id/:name/:email',async (req, res) => {
  const { id, token, name, email } = req.params;
  if (!name || !email) {
    return res.status(400).send({ error: 'Name and Email are required' });
  }

  // you can implement multi-configuration as cheking for time and multi-variable of user website to avoid misuse
  const tokenCheckPostgres = await searchToken('postgres', token);
  const tokenCheckMySQL = await searchToken('mysql', token);
  const tokenCheckSQLite = await searchToken('sqlite', token);
  const tokenCheckMongo = await searchToken('mongo', token);

  if (tokenCheckPostgres.success) {
    updateInPostgres(id, name, email, res);
  } else if (tokenCheckMySQL.success) {
    updateInMySQL(id, name, email, res);
  } else if (tokenCheckSQLite.success) {
    updateInSQLite(id, name, email, res);
  } else if (tokenCheckMongo.success) {
    updateInMongo(id, name, email, res);
  } else {
    res.status(400).send({ error: 'Unsupported update database or Unsupported Token!' });
  }
});

async function searchToken(dbtype, token) {
  try {
    switch (dbtype.toLowerCase()) {
      case 'mysql':
        return new Promise((resolve, reject) => {
          mysqlConnection.query(
            'SELECT * FROM tokens WHERE token = ?',
            [token],
            (err, results) => {
              if (err) {
                reject({ success: false, error: err.message });
              } else if (results.length === 0) {
                resolve({ success: false, message: 'Token not found in MySQL' });
              } else {
                resolve({ success: true, data: results[0], message: 'Token found in MySQL' });
              }
            }
          );
        });

      case 'mongo':
        const mongoResult = await MongoToken.findOne({ client_token: token }).exec();
        if (!mongoResult) {
          return { success: false, message: 'Token not found in MongoDB' };
        }
        return { success: true, data: mongoResult, message: 'Token found in MongoDB' };

      case 'postgres':
        const pgResult = await pgPool.query('SELECT * FROM tokens WHERE token = $1', [token]);
        if (pgResult.rows.length === 0) {
          return { success: false, message: 'Token not found in PostgreSQL' };
        }
        return { success: true, data: pgResult.rows[0], message: 'Token found in PostgreSQL' };

      case 'sqlite':
        return new Promise((resolve, reject) => {
          sqliteConnection.get(
            'SELECT * FROM tokens WHERE token = ?',
            [token],
            (err, row) => {
              if (err) {
                reject({ success: false, error: err.message });
              } else if (!row) {
                resolve({ success: false, message: 'Token not found in SQLite' });
              } else {
                resolve({ success: true, data: row, message: 'Token found in SQLite' });
              }
            }
          );
        });

      default:
        return { success: false, error: 'Invalid database type provided' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}


// Helper functions for each database type
const deleteFromPostgres = (id, res) => {
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
};

const deleteFromMySQL = (id, res) => {
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
};

const deleteFromSQLite = (id, res) => {
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
};

const deleteFromMongo = (id, res) => {
  MongoUser.findByIdAndDelete(id)
    .then(user => {
      if (!user) {
        return res.status(404).send({ error: 'User not found' });
      }
      res.status(200).send({ message: 'User deleted successfully', id: user._id });
    })
    .catch(err => {
      res.status(500).send({ error: 'Error deleting user from MongoDB' });
    });
};

const updateInPostgres = (id, name, email, res) => {
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
};

const updateInMySQL = (id, name, email, res) => {
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
};

const updateInSQLite = (id, name, email, res) => {
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
};

const updateInMongo = (id, name, email, res) => {
  MongoUser.findByIdAndUpdate(id, { name, email }, { new: true })
    .then(user => {
      if (!user) {
        return res.status(404).send({ error: 'User not found' });
      }
      res.status(200).send({ id: user._id, name, email });
    })
    .catch(err => {
      res.status(500).send({ error: 'Error updating user in MongoDB' });
    });
};


const fetchFromPostgres = async () => {
  try {
    const result = await pgPool.query('SELECT * FROM users');
    return { success: true, data: result.rows };
  } catch (err) {
    console.error('Postgres Fetch Error:', err);
    throw new Error('Error fetching users from PostgreSQL');
  }
};

const fetchFromMySQL = () => {
  return new Promise((resolve, reject) => {
    mysqlConnection.query('SELECT * FROM users', (err, results) => {
      if (err) {
        console.error('MySQL Fetch Error:', err);
        reject(new Error('Error fetching users from MySQL'));
      } else {
        resolve({ success: true, data: results });
      }
    });
  });
};

const fetchFromSQLite = () => {
  return new Promise((resolve, reject) => {
    sqliteConnection.all('SELECT * FROM users', [], (err, rows) => {
      if (err) {
        console.error('SQLite Fetch Error:', err);
        reject(new Error('Error fetching users from SQLite'));
      } else {
        resolve({ success: true, data: rows });
      }
    });
  });
};

const fetchFromMongo = async () => {
  try {
    const users = await MongoUser.find({});
    return { success: true, data: users };
  } catch (err) {
    console.error('MongoDB Fetch Error:', err);
    throw new Error('Error fetching users from MongoDB');
  }
};