# README for User API

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
1. Clone the repository:
   git clone <repository-url>
   cd api-intgration-multi-dbs
Install the dependencies:

نسخ الكود
npm install
Set up the databases:

Ensure MySQL, SQLite, MongoDB, and PostgreSQL are installed and running.
Create a database named testdb in MySQL and PostgreSQL.
Run the init_sqlite.js script to create the SQLite database and users table:
bash
نسخ الكود
node init_sqlite.js
Usage
Start the server:

bash
نسخ الكود
node server.js
Access the API at http://localhost:3000.

API Endpoints
Fetch Users
Description: Fetch all users from the specified database.
Endpoints:

MySQL: GET /mysql
SQLite: GET /sqlite
MongoDB: GET /mongo
PostgreSQL: GET /postgres
All Databases: GET /all
Insert User
Description: Insert a new user into the specified database.
Endpoints:

MySQL: GET /mysql/insert/:name/:email
SQLite: GET /sqlite/insert/:name/:email
MongoDB: GET /mongo/insert/:name/:email
PostgreSQL: GET /postgres/insert/:name/:email
Update User
Description: Update an existing user in the specified database.
Endpoints:

MySQL: GET /mysql/update/:id/:name/:email
SQLite: GET /sqlite/update/:id/:name/:email
MongoDB: GET /mongo/update/:id/:name/:email
PostgreSQL: GET /postgres/update/:id/:name/:email
Delete User
Description: Delete a user from the specified database.
Endpoints:

MySQL: GET /mysql/delete/:id
SQLite: GET /sqlite/delete/:id
MongoDB: GET /mongo/delete/:id
PostgreSQL: GET /postgres/delete/:id
Dependencies
express: ^4.21.2
express-rate-limit: ^7.5.0
faker: ^5.5.3
mongoose: ^8.9.2
mysql2: ^3.12.0
pg: ^8.13.1
sqlite3: ^5.1.7
