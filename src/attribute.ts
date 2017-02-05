/** Contains all of the attribute querying types. */
import * as _ from 'lodash';
import { col as sequelizeCol, fn as sequelizeFn } from 'sequelize';

import { Where } from './where';

/**
 * A helper function to construct a column attribute.
 * This will function the same as the Sequelize function
 * with the same name when used in a query, but will
 * fully support the type-safe capabilities of Squell.
 */
export function col(name: string): Attribute<any> {
  return new ColumnAttribute(name);
}

/**
 * A helper function to construct a function attribute.
 * This will function in a type-safe manner on the Squell end,
 * but compile down to the function of the same name on
 * the Sequelize end.
 *
 * Once a function is wrapped as an attribute using the,
 * its result can be aliased using the as method to store
 * it's result into a virtual attribute.
 *
 * @see as
 */
export function fn(name: string, ...args: Attribute<any>[]): Attribute<any> {
  return new FunctionAttribute(name, args);
}

/**
 * A helper function to construct a constant attribute.
 *
 * When this value is used internally as a Sequelize value,
 * it will be represented exactly as the value given. For the most
 * part, the Squell query language should completely facilitate
 * this sort of functionality on its own, but this function may be necessary in some cases.
 */
export function constant<T>(value: any): Attribute<T> {
  return new ConstantAttribute(value);
}

/**
 * Represents an attribute of a model.
 * Squell abstracts this out so that where queries can be built
 * up in a type-safe way. To do a where query, you simply
 * call one of the relevant comparator methods. Each
 * method corresponds to a Sequelize query operator.
 *
 * @param T The contained model attribute type.
 */
export abstract class Attribute<T> {
  /**
   * Check if an attribute is equal to another attribute or constant value.
   * Equivalent to the $eq operator in Sequelize.
   *
   * @param other The attribute or constant value to compare.
   * @returns The generated where query.
   */
  public eq(other: T | Attribute<T>): Where {
    return this.build(other);
  }

  /**
   * Check if an attribute is not equal to another attribute or constant value.
   * Equivalent to the $ne operator in Sequelize.
   *
   * @param other The attribute or constant value to compare.
   * @returns The generated where query.
   */
  public ne(other: T | Attribute<T>): Where {
    return this.build(other, '$ne');
  }

  /**
   * Check if an attribute is not equal to another attribute or constant value.
   * Equivalent to the $gt operator in Sequelize.
   *
   * @param other The attribute or constant value to compare.
   * @returns The generated where query.
   */
  public gt(other: T | Attribute<T>): Where {
    return this.build(other, '$gt');
  }

  /**
   * Check if an attribute is not equal to another attribute or constant value.
   * Equivalent to the $gte operator in Sequelize.
   *
   * @param other The attribute or constant value to compare.
   * @returns The generated where query.
   */
  public gte(other: T | Attribute<T>): Where {
    return this.build(other, '$gte');
  }

  /**
   * Check if an attribute is not equal to another attribute or constant value.
   * Equivalent to the $lt operator in Sequelize.
   *
   * @param other The attribute or constant value to compare.
   * @returns The generated where query.
   */
  public lt(other: T | Attribute<T>): Where {
    return this.build(other, '$lt');
  }

  /**
   * Check if an attribute is not equal to another attribute or constant value.
   * Equivalent to the $;te operator in Sequelize.
   *
   * @param other The attribute or constant value to compare.
   * @returns The generated where query.
   */
  public lte(other: T | Attribute<T>): Where {
    return this.build(other, '$lte');
  }

  /**
   * Check if an attribute is not equal to another attribute or constant string.
   * Equivalent to the $like operator in Sequelize.
   *
   * @param other The attribute or constant string to compare.
   * @returns The generated where query.
   */
  public like(other: string | Attribute<T>): Where {
    return this.build(other, '$like');
  }

  /**
   * Check if an attribute is not equal to another attribute or constant string.
   * Equivalent to the $notLike operator in Sequelize.
   *
   * @param other The attribute or constant string to compare.
   * @returns The generated where query.
   */
  public notLike(other: string | Attribute<T>): Where {
    return this.build(other, '$notLike');
  }

  /**
   * Check if an attribute is not equal to another attribute or constant string.
   * Equivalent to the $iLike operator in Sequelize.
   *
   * @param other The attribute or constant string to compare.
   * @returns The generated where query.
   */
  public iLike(other: string | Attribute<T>): Where {
    return this.build(other, '$iLike');
  }

  /**
   * Check if an attribute is not equal to another attribute or constant string.
   * Equivalent to the $notILike operator in Sequelize.
   *
   * @param other The attribute or constant string to compare.
   * @returns The generated where query.
   */
  public notILike(other: string | Attribute<T>): Where {
    return this.build(other, '$notILike');
  }

  /**
   * Check if an attribute is not equal to another attribute or constant bool.
   * Equivalent to the $not operator in Sequelize.
   *
   * @param other The attribute or constant bool to compare.
   * @returns The generated where query.
   */
  public not(other: boolean | Attribute<T>): Where {
    return this.build(other, '$not');
  }

  /**
   * Cast an attribute from one contained type to another. This will ignore
   * any type constraints and generally goes against everything Squell was designed for (type-safe queries).
   * Nonetheless, there may be a situation where this is necessary due to typing issues.
   */
  public cast(): Attribute<any> {
    return this;
  }

  /**
   * Alias an attribute under a different name. If you provide a string it will use that as a name,
   * otherwise it will use the underlying name of a provided attribute.
   * The more type-safe option is to alias to another attribute object, as that will let you
   * store a function attribute under an actual attribute of the model. The attribute should be set to virtual
   * if it's not meant to be synced to the database.
   *
   */
  public as<T>(aliased: string | Attribute<T>): Attribute<T> {
    return new AliasAttribute(aliased instanceof Attribute ? aliased.compileLeft() : aliased, this);
  }

  /**
   * Check if an attribute is one of the values in a constant array.
   * Equivalent to the $in operator in Sequelize.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  public in(other: T[]): Where {
    return this.build(other, '$in');
  }

  /**
   * Check if an attribute is not one of the values in a constant array.
   * Equivalent to the $notIn operator in Sequelize.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  public notIn(other: T[]): Where {
    return this.build(other, '$notIn');
  }

  /**
   * Check if an attribute is between two constant values.
   * This is a bound inclusive check.
   * Equivalent to the $between operator in Sequelize.
   *
   * @param other The lower and upper bound constant to check.
   * @returns The generated where query.
   */
  public between(other: [T, T]): Where {
    return this.build(other, '$between');
  }

  /**
   * Check if an attribute is not between two constant values.
   * This is a bound exclusive check.
   * Equivalent to the $notBetween operator in Sequelize.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  public notBetween(other: [T, T]): Where {
    return this.build(other, '$notBetween');
  }

  /**
   * Check if an attribute overlaps a constant array.
   * Equivalent to the $overlap operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  public overlap(other: T[]): Where {
    return this.build(other, '$overlap');
  }

  /**
   * Check if an attribute contains a constant array.
   * Equivalent to the $contains operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  public contains(other: T | T[]): Where {
    return this.build(other, '$contains');
  }

  /**
   * Check if an attribute is contained in a constant array.
   * Equivalent to the $contained operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  public contained(other: T[]): Where {
    return this.build(other, '$contained');
  }

  /**
   * Check if an attribute has any common elements with a constant array.
   * Equivalent to the $any operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  public any(other: T[]): Where {
    return this.build(other, '$any');
  }

  /**
   * Check if an attribute is adjacent to a constant array.
   * Equivalent to the $adjacent operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  public adjacent(other: T[]): Where {
    return this.build(other, '$adjacent');
  }

  /**
   * Check if an attribute is strictly left of a constant array.
   * Equivalent to the $strictLeft operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  public strictLeft(other: T[]): Where {
    return this.build(other, '$strictLeft');
  }

  /**
   * Check if an attribute is strictly right of a constant array.
   * Equivalent to the $strictRight operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  public strictRight(other: T[]): Where {
    return this.build(other, '$strictRight');
  }

  /**
   * Check if an attribute extends right of a constant array.
   * Equivalent to the $noExtendRight operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  public noExtendRight(other: T[]): Where {
    return this.build(other, '$noExtendRight');
  }

  /**
   * Check if an attribute extends left of a constant array.
   * Equivalent to the $noExtendLeft operator in Sequelize, which only works in Postgres.
   *
   * @param other The constant array to check.
   * @returns The generated where query.
   */
  public noExtendLeft(other: T[]): Where {
    return this.build(other, '$noExtendLeft');
  }

  /**
   * An abstract method that should compile the attribute
   * into an equivalent left-side format to be used in.
   * The left-side vs right-side distinction is to do with what
   * side of the colon the attribute would normally be used in Sequelize options.
   *
   * For example, the attribute name username would translate to the object key
   * `username` in the statement `{ where: { username: 'hunter2' }}`. But if it was
   * being used as a right side, it would need to be wrapped in a `Sequelize.col`
   * call in order to properly filter by the `username` attribute value (
   * otherwise it would be interpreted as a string). This distinction handles that
   * automatically for all sub-classes of an attribute.
   */
  public abstract compileRight(): any;

  /**
   * An abstract method that should compile the attribute into its
   * right-side format.
   */
  public abstract compileLeft(): any;

  /**
   * A generic where query builder, that will compare the attribute
   * to another attribute or constant value using a specific Sequelize operator.
   *
   * @param other The attribute or constant value.
   * @param operator The Sequelize operator to use in the comparison.
   */
  protected build(other: any | Attribute<T>, operator = '$eq'): Where {
    let value = other instanceof Attribute
      ? other.compileRight()
      : other;

    let operation = operator === '$eq'
      ? value
      : _.fromPairs([[operator, value]]);

    return new Where(_.fromPairs([[this.compileLeft(), operation]]));
  }
}

/**
 * The standard attribute, representing
 * a plain attribute, i.e. a generic attribute of a model.
 * This simply boils down to a name of the attribute with
 * no other data.
 *
 * @param T The contained model attribute type.
 */
export class PlainAttribute<T> extends Attribute<T> {
  /** The attribute name. */
  private name: string;

  /**
   * Construct a plain attribute from a name.
   *
   * @param name The attribute name.
   */
  constructor(name: string) {
    super();

    this.name = name;
  }

  public compileRight(): any {
    return sequelizeCol(this.name);
  }

  public compileLeft(): any {
    return this.name;
  }
}

/**
 * An attribute representing an arbitary column.
 * This could be a column selected manually, and might
 * not necessarily be a column from a model.
 *
 * @param T The contained model attribute type.
 */
export class ColumnAttribute<T> extends Attribute<T> {
  /** The column name. */
  private name: string;

  /**
   * Construct a column attribute from a column name.
   *
   * @param name The column name.
   */
  constructor(name: string) {
    super();

    this.name = name;
  }

  public compileRight(): any {
    return sequelizeCol(this.name);
  }

  public compileLeft(): never {
    throw new SyntaxError('A column attribute cannot be used as a left operator in a Squell query');
  }
}

/**
 * An attribute representing a call to a SQL function.
 * A function attribute contains both the name of a function
 * being called, and the attribute arguments to it.
 *
 * @param T The contained model attribute type.
 */
export class FunctionAttribute<T> extends Attribute<T> {
  /** The function name. */
  private name: string;

  /** The function arguments. */
  private args: Attribute<any>[];

  /**
   * Construct a function attribute from a function name and arguments.
   *
   * @param name The function name.
   * @param args The function arguments.
   */
  constructor(name: string, args: Attribute<any>[]) {
    super();

    this.name = name;
    this.args = args;
  }

  public compileRight(): any {
    return sequelizeFn.apply(sequelizeFn, [this.name].concat(this.args.map(a => a.compileRight())));
  }

  public compileLeft(): never {
    throw new SyntaxError('A function attribute cannot be used as a left operator in a Squell query');
  }
}

/**
 * An attribute representing an arbitary constant value.
 *
 * @param T The contained model attribute type.
 */
export class ConstantAttribute<T> extends Attribute<T> {
  /** The constant value. */
  private value: any;

  /**
   * Construct a constant attribute from a constant value.
   *
   * @param value The constant value.
   */
  constructor(value: any) {
    super();

    this.value = value;
  }

  public compileRight(): any {
    return this.value;
  }

  public compileLeft(): any {
    return this.value;
  }
}

/**
 * An attribute representing an aliased attribute.
 * An aliased attribute wraps another attribute under a new name.
 *
 * @param T The contained model attribute type.
 */
export class AliasAttribute<T> extends Attribute<T> {
  /** The aliased name. */
  private name: string;

  /** The original alias. */
  private aliased: Attribute<any>;

  /**
   * Construct an alias attribute from an alias name and an original attribute.
   *
   * @param name The alias name.
   * @param aliased The original attribute.
   */
  constructor(name: string, aliased: Attribute<any>) {
    super();

    this.name = name;
    this.aliased = aliased;
  }

  public compileRight(): any {
    return [this.aliased.compileRight(), this.name];
  }

  public compileLeft(): never {
    throw new SyntaxError('An aliased attribute cannot be used as a left operator in a Squell query');
  }
}

/**
 * An attribute representing an association attribute.
 * This is the same as a plain attribute for now,
 * but may be used for something different in the future.
 */
export class AssocAttribute<T> extends PlainAttribute<T> {

}
