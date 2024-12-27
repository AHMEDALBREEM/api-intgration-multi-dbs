
# User API Database Management

## Overview
This API allows you to interact with user data stored in multiple databases, including MySQL, SQLite, MongoDB, and PostgreSQL. You can perform CRUD (Create, Read, Update, Delete) operations on user data through various endpoints.

## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
  - [Fetch Users](#fetch-users)
  - [Insert User](#insert-user)
  - [Update User](#update-user)
  - [Delete User](#delete-user)
- [Dependencies](#dependencies)
- [License](#license)

## Installation

Clone the repository:

```bash
git clone <repository-url>
cd api-intgration-multi-dbs
```

Install the dependencies:

```bash
npm install
```

Set up the databases:

- Ensure MySQL, SQLite, MongoDB, and PostgreSQL are installed and running.
- Create a database named `testdb` in MySQL and PostgreSQL.
- Run the `init_sqlite.js` script to create the SQLite database and users table:

```bash
node init_sqlite.js
```

## Usage

Start the server:

```bash
node server.js
```

Access the API at `http://localhost:3000`.

## API Endpoints (with api key private gerearte by admin for dierct end-points)

### Fetch Users
**Description:** Fetch all users from the specified database.

- **MySQL:** `GET /mysql`
- **SQLite:** `GET /sqlite`
- **MongoDB:** `GET /mongo`
- **PostgreSQL:** `GET /postgres`
- **All Databases:** `GET /all`

### Insert User
**Description:** Insert a new user into the specified database.

- **MySQL:** `GET /mysql/insert/:name/:email`
- **SQLite:** `GET /sqlite/insert/:name/:email`
- **MongoDB:** `GET /mongo/insert/:name/:email`
- **PostgreSQL:** `GET /postgres/insert/:name/:email`

### Update User
**Description:** Update an existing user in the specified database.

- **MySQL:** `GET /mysql/update/:id/:name/:email`
- **SQLite:** `GET /sqlite/update/:id/:name/:email`
- **MongoDB:** `GET /mongo/update/:id/:name/:email`
- **PostgreSQL:** `GET /postgres/update/:id/:name/:email`

### Delete User
**Description:** Delete a user from the specified database.

- **MySQL:** `GET /mysql/delete/:id`
- **SQLite:** `GET /sqlite/delete/:id`
- **MongoDB:** `GET /mongo/delete/:id`
- **PostgreSQL:** `GET /postgres/delete/:id`

## Dependencies
- express: ^4.21.2
- express-rate-limit: ^7.5.0
- faker: ^5.5.3
- mongoose: ^8.9.2
- mysql2: ^3.12.0
- pg: ^8.13.1
- sqlite3: ^5.1.7
- axios: ^1.7.9
- cors: ^2.8.5
- crypto: ^1.0.1
- path: ^0.12.7
- jsonwebtoken: ^9.0.2

## License
This project is licensed under the MIT License. See the LICENSE file for details.

## Additional Information

### Database Initialization Script (`init_sqlite.js`)
This script initializes the SQLite database and creates a users table if it does not already exist.

```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('test.db');

db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)');
});

db.close();
```

### Server Implementation (`server.js`)
The server is built using Express and connects to multiple databases. It includes middleware for rate limiting, CORS, and JSON parsing. The server listens on port 3000 and provides various endpoints for user management.

### Frontend Interface (`public/index.html`)(without api key but with ip allowed to login if reached to the index)
The frontend interface allows users to interact with the API through buttons and forms for fetching, inserting, updating, and deleting users. It includes basic validation for email input and displays responses from the API.
