# Squell

## Introduction

Squell is a type-safe wrapper for the Sequelize library, usable in TypeScript 2.1+ projects.
Squell takes the Sequelize type definitions a step further by allowing models to be designed
using decorators. Each model is defined as a class with all of its properties being decorated
with the relevant Sequelize data types.

Additionally to simplifying the process of defining models, Squell provides what is
essentially a type-safe query language that compiles down to Sequelize queries.
This means that any queries on the database are partially checked at compile time,
which obviously can't capture all errors, but stops small issues like type inconsistencies
and typos.

## Installation

```sh
npm install --save squell
```

## Usage

A model definition for a web application's user might look something like this:

```typescript
@model('user')
class User extends Model {
  @attr(squell.INTEGER, { primaryKey: true, autoIncrement: true })
  public id: number;
  
  @attr(squell.STRING)
  public username: string;
  
  @attr(squell.DATE)
  public createdAt: Date;
  
  @attr(squell.DATE)
  public updatedAt: Date;
  
  @attr(squell.STRING)
  public email: string;
}
```

To query that model, you might do something like this:

```typescript
let db = new squell.Database('mysql://username:password@localhost/db');

db.query(User)
  .where(m => m.email.eq('test@example.com').or(m.id.lt(5)))
  .find()
  .then((users: User[]) => {
    // Do something with `users`.
  });
```

This query would find a user with the email of exactly `test@example.com`,
or an ID larger than 5, but with the benefit of the query being checked
at compile time. Take a look at the API documentation for more information
on the query operators available - but for the most part they are the same
as the Sequelize operators.

## Documentatation

The API documentation generated using [TypeDoc](https://github.com/TypeStrong/typedoc)
is [available online](http://creativecuriosity.github.io/squell).

To generate API documentation from the code into the `docs` directory, run:

```sh
npm run docs
```

## License

This project is licensed under the MIT license. Please see `LICENSE.md` for more details.

## Limitations

* Squell doesn't currently support defining or querying relationships. This is next on the roadmap.
* Models must always be direct subclasses of the abstract model class. Unfortunately there does not appear
  to be a way to inherit attributes decorated in a parent class yet.
