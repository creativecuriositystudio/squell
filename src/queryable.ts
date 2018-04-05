/** Contains all of the queryable querying types. */
import * as _ from 'lodash';
import { Model } from 'modelsafe';
import { col as sequelizeCol, fn as sequelizeFn, Op } from 'sequelize';

import { Where } from './where';

/**
 * Construct an attribute queryable from an absolute attribute path.
 *
 * This should be used for path-specific queries on model attributes
 * that cannot easily be constructed using the query DSL.
 */
export function attribute(name: string): AttributeQueryable<any> {
  return new AttributeQueryable(name);
}

/**
 * Construct a column queryable.
 *
 * This will function the same as the Sequelize function
 * with the same name when used in a query.
 */
export function col(name: string): ColumnQueryable<any> {
  return new ColumnQueryable(name);
}

/**
 * Construct a function queryable.
 *
 * This will function in a type-safe manner on the Squell end,
 * but compile down to the function of the same name on
 * the Sequelize end.
 *
 * Once a function is wrapped as a queryable,
 * its result can be aliased using the `as` method to store
 * it's result into a specific queryable path.
 *
 * @see as
 */
export function fn(name: string, ...args: Queryable<any>[]): FunctionQueryable<any> {
  return new FunctionQueryable(name, args);
}

/**
 * Construct a constant queryable.
 *
 * When this value is used internally as a Sequelize value,
 * it will be represented exactly as the value given. For the most
 * part, the Squell query DSL should completely facilitate
 * this sort of functionality on its own, but this function may be necessary in some cases.
 */
export function constant<T>(value: any): ConstantQueryable<T> {
  return new ConstantQueryable<T>(value);
}

/**
 * Represents a queryable property of a model or other non-model specific
 * queryable operations, like SQL functions, constants, etc.
 *
 * Squell abstracts this out so that where queries can be built
 * up in a type-safe way. To perform a certain comparison on a queryable,
 * you simply call the relevant comparison method. These comparisons
 * can then be composed by using the `Where` classes `and`/`or` methods.
 *
 * @param T The underlying type of the queryable.
 */
export abstract class Queryable<T> {
  /**
   * Check if a queryable is equal to another queryable or constant value.
   * Equivalent to the $eq operator in Sequelize.
   *
   * @param other The queryable or constant value to compare.
   * @returns The generated where query.
   */
  eq(other: T | Queryable<T>): Where {
    return this.build(other);
  }

  /**
   * Check if a queryable is not equal to another queryable or constant value.
   * Equivalent to the $ne operator in Sequelize.
   *
   * @param other The queryable or constant value to compare.
   * @returns The generated where query.
   */
  ne(other: T | Queryable<T>): Where {
    return this.build(other, Op.ne);
  }

  /**
   * Check if a queryable is not equal to another queryable or constant value.
   * Equivalent to the $gt operator in Sequelize.
   *
   * @param other The queryable or constant value to compare.
   * @returns The generated where query.
   */
  gt(other: T | Queryable<T>): Where {
    return this.build(other, Op.gt);
  }

  /**
   * Check if a queryable is not equal to another queryable or constant value.
   * Equivalent to the $gte operator in Sequelize.
   *
   * @param other The queryable or constant value to compare.
   * @returns The generated where query.
   */
  gte(other: T | Queryable<T>): Where {
    return this.build(other, Op.gte);
  }

  /**
   * Check if a queryable is not equal to another queryable or constant value.
   * Equivalent to the $lt operator in Sequelize.
   *
   * @param other The queryable or constant value to compare.
   * @returns The generated where query.
   */
  lt(other: T | Queryable<T>): Where {
    return this.build(other, Op.lt);
  }

  /**
   * Check if a queryable is not equal to another queryable or constant value.
   * Equivalent to the $lte operator in Sequelize.
   *
   * @param other The queryable or constant value to compare.
   * @returns The generated where query.
   */
  lte(other: T | Queryable<T>): Where {
    return this.build(other, Op.lte);
  }

  /**
   * Check if a queryable is not equal to another queryable or constant string.
   * Equivalent to the $like operator in Sequelize.
   *
   * @param other The queryable or constant string to compare.
   * @returns The generated where query.
   */
  like(other: string | Queryable<T>): Where {
    return this.build(other, Op.like);
  }

  /**
   * Check if a queryable is not equal to another queryable or constant string.
   * Equivalent to the $notLike operator in Sequelize.
   *
   * @param other The queryable or constant string to compare.
   * @returns The generated where query.
   */
  notLike(other: string | Queryable<T>): Where {
    return this.build(other, Op.notLike);
  }

  /**
   * Check if a queryable is not equal to another queryable or constant string.
   * Equivalent to the $iLike operator in Sequelize.
   *
   * @param other The queryable or constant string to compare.
   * @returns The generated where query.
   */
  iLike(other: string | Queryable<T>): Where {
    return this.build(other, Op.iLike);
  }

  /**
   * Check if a queryable is not equal to another queryable or constant string.
   * Equivalent to the $notILike operator in Sequelize.
   *
   * @param other The queryable or constant string to compare.
   * @returns The generated where query.
   */
  notILike(other: string | Queryable<T>): Where {
    return this.build(other, Op.notILike);
  }

  /**
   * Check if a queryable is not equal to another queryable or constant bool.
   * Equivalent to the $not operator in Sequelize.
   *
   * @param other The queryable or constant bool to compare.
   * @returns The generated where query.
   */
  not(other: boolean | Queryable<T>): Where {
    return this.build(other, Op.not);
  }

  /**
   * Cast a queryable from one contained type to another. This will ignore
   * any type constraints and generally goes against what Squell was designed for (type-safe queries).
   * Nonetheless, there may be a situation where this is necessary due to typing issues.
   */
  cast(): Queryable<any> {
    return this;
  }

  /**
   * Alias a queryable under a different name.
   *
   * If you provide a string it will use that as a name,
   * otherwise it will use the underlying name of a provided queryable.
   * The more type-safe option is to alias to another queryable object, as that will let you
   * store a function queryable under an actual queryable of the model. The queryable should be set to virtual
   * if it's not meant to be synced to the database.
   */
  as<T>(aliased: string | Queryable<T>): Queryable<T> {
    return new AliasQueryable(typeof (aliased) !== 'string' ? aliased.compileLeft() : aliased, this);
  }

  /**
   * Check if a queryable is one of the values in a constant array.
   * Equivalent to the $in operator in Sequelize.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  in(other: T[]): Where {
    return this.build(other, Op.in);
  }

  /**
   * Check if a queryable is not one of the values in a constant array.
   * Equivalent to the $notIn operator in Sequelize.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  notIn(other: T[]): Where {
    return this.build(other, Op.notIn);
  }

  /**
   * Check if a queryable is between two constant values.
   * This is a bound inclusive check.
   * Equivalent to the $between operator in Sequelize.
   *
   * @param other The lower and upper bound constant to check.
   * @returns The generated where query.
   */
  between(other: [T, T]): Where {
    return this.build(other, Op.between);
  }

  /**
   * Check if a queryable is not between two constant values.
   * This is a bound exclusive check.
   * Equivalent to the $notBetween operator in Sequelize.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  notBetween(other: [T, T]): Where {
    return this.build(other, Op.notBetween);
  }

  /**
   * Check if a queryable overlaps a constant array.
   * Equivalent to the $overlap operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  overlap(other: T[]): Where {
    return this.build(other, Op.overlap);
  }

  /**
   * Check if a queryable contains a constant array.
   * Equivalent to the $contains operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  contains(other: T | T[]): Where {
    return this.build(other, Op.contains);
  }

  /**
   * Check if a queryable is contained in a constant array.
   * Equivalent to the $contained operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  contained(other: T[]): Where {
    return this.build(other, Op.contained);
  }

  /**
   * Check if a queryable has any common elements with a constant array.
   * Equivalent to the $any operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  any(other: T[]): Where {
    return this.build(other, Op.any);
  }

  /**
   * Check if a queryable is adjacent to a constant array.
   * Equivalent to the $adjacent operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  adjacent(other: T[]): Where {
    return this.build(other, Op.adjacent);
  }

  /**
   * Check if a queryable is strictly left of a constant array.
   * Equivalent to the $strictLeft operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  strictLeft(other: T[]): Where {
    return this.build(other, Op.strictLeft);
  }

  /**
   * Check if a queryable is strictly right of a constant array.
   * Equivalent to the $strictRight operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  strictRight(other: T[]): Where {
    return this.build(other, Op.strictRight);
  }

  /**
   * Check if a queryable extends right of a constant array.
   * Equivalent to the $noExtendRight operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  noExtendRight(other: T[]): Where {
    return this.build(other, Op.noExtendRight);
  }

  /**
   * Check if a queryable extends left of a constant array.
   * Equivalent to the $noExtendLeft operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  noExtendLeft(other: T[]): Where {
    return this.build(other, Op.noExtendLeft);
  }

  /**
   * An abstract method that should compile the queryable
   * into an equivalent left-side format to be used in.
   * The left-side vs right-side distinction is to do with what
   * side of the colon the queryable would normally be used in Sequelize options.
   *
   * For example, the queryable name username would translate to the object key
   * `username` in the statement `{ where: { username: 'hunter2' }}`. But if it was
   * being used as a right side, it would need to be wrapped in a `Sequelize.col`
   * call in order to properly filter by the `username` queryable value (
   * otherwise it would be interpreted as a string). This distinction handles that
   * automatically for all sub-classes of a queryable.
   */
  abstract compileRight(): any;

  /**
   * An abstract method that should compile the queryable into its
   * right-side format.
   */
  abstract compileLeft(): any;

  /**
   * A generic where query builder, that will compare the queryable
   * to another queryable or constant value using a specific Sequelize operator.
   *
   * @param other The queryable or constant value.
   * @param operator The Sequelize operator to use in the comparison.
   */
  protected build(other: any | Queryable<T>, operator: symbol = Op.eq): Where {
    let value = other instanceof Queryable
      ? other.compileRight()
      : other;

    let operation = operator === Op.eq
      ? value
      : _.fromPairs([[operator, value]]);

    return new Where(_.fromPairs([[this.compileLeft(), operation]]));
  }
}

/**
 * A queryable representing the attribute of a model.
 *
 * @param T The underlying type of the queryable.
 */
export class AttributeQueryable<T> extends Queryable<T> {
  /** The underlying attribute name. */
  private name: string;

  /**
   * Construct a queryable from an attribute name.
   *
   * @param name The queryable name.
   */
  constructor(name: string) {
    super();

    this.name = name;
  }

  /** Compiles into the right side format. */
  compileRight(): any {
    return sequelizeCol(this.name);
  }

  /** Compiles into the left side format. */
  compileLeft(): any {
    return this.name;
  }
}

/**
 * A queryable representing an arbitary column.
 * This could be a column selected manually, and might
 * not necessarily be a column from a model.
 *
 * @param T The underlying type of the queryable.
 */
export class ColumnQueryable<T> extends Queryable<T> {
  /** The column name. */
  private name: string;

  /**
   * Construct a column queryable from a column name.
   *
   * @param name The column name.
   */
  constructor(name: string) {
    super();

    this.name = name;
  }

  /** Compiles into the right side format. */
  compileRight(): any {
    return sequelizeCol(this.name);
  }

  /** Compiles into the left side format. */
  compileLeft(): never {
    throw new SyntaxError('A column queryable cannot be used as a left operator in a Squell query');
  }
}

/**
 * A queryable representing a call to a SQL function.
 * A function queryable contains both the name of a function
 * being called, and the queryable arguments to it.
 *
 * @param T The underlying type of the queryable.
 */
export class FunctionQueryable<T> extends Queryable<T> {
  /** The function name. */
  private name: string;

  /** The function arguments, represented as queryables. */
  private args: Queryable<any>[];

  /**
   * Construct a function queryable from a function name and arguments.
   *
   * @param name The function name.
   * @param args The function arguments as queryables.
   */
  constructor(name: string, args: Queryable<any>[]) {
    super();

    this.name = name;
    this.args = args;
  }

  /** Compiles into the right side format. */
  compileRight(): any {
    return sequelizeFn.apply(sequelizeFn, [this.name].concat(this.args.map(a => a.compileRight())));
  }

  /** Compiles into the left side format. */
  compileLeft(): never {
    throw new SyntaxError('A function queryable cannot be used as a left operator in a Squell query');
  }
}

/**
 * A queryable representing an arbitary constant value.
 *
 * @param T The underlying type of the queryable.
 */
export class ConstantQueryable<T> extends Queryable<T> {
  /** The constant value. */
  private value: any;

  /**
   * Construct a constant queryable from some value.
   *
   * @param value The constant value.
   */
  constructor(value: any) {
    super();

    this.value = value;
  }

  /** Compiles into the right side format. */
  compileRight(): any {
    return this.value;
  }

  /** Compiles into the left side format. */
  compileLeft(): any {
    return this.value;
  }
}

/**
 * A queryable that has been aliased.
 * An aliased queryable wraps another queryable under a new name,
 * or in the case of function queryables, specifies the name
 * the function result will be output under.
 *
 * @param T The underlying type of the queryable.
 */
export class AliasQueryable<T> extends Queryable<T> {
  /** The aliased name. */
  private name: string;

  /** The original queryable. */
  private aliased: Queryable<any>;

  /**
   * Construct an alias queryable from an alias name and an original queryable.
   *
   * @param name The alias name.
   * @param aliased The original queryable.
   */
  constructor(name: string, aliased: Queryable<any>) {
    super();

    this.name = name;
    this.aliased = aliased;
  }

  /** Compiles into the right side format. */
  compileRight(): any {
    return [this.aliased.compileRight(), this.name];
  }

  /** Compiles into the left side format. */
  compileLeft(): never {
    throw new SyntaxError('An aliased queryable cannot be used as a left operator in a Squell query');
  }
}

/**
 * A queryable representing the association of a model.
 *
 * @param T The underlying type of the queryable.
 */
export class AssociationQueryable<T> extends AttributeQueryable<T> {}

/**
 * A mapped type that maps all of a model properties
 * to Squell queryables to support type-safe queries.
 */
export type ModelQueryables<T extends Model> = {
  [P in keyof T]: Queryable<T[P]>;
};
