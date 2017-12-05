/** Contains the where class. */
import { AnyWhereOptions, Op } from 'sequelize';

/* tslint:disable-next-line:no-var-requires */
let cloner = require('./cloner');

/**
 * Represents a type-safe where query that maps directly to a Sequelize query.
 */
export class Where {
  /** The Sequelize representation of the where query. */
  private repr: AnyWhereOptions;

  /**
   * Construct a where query from an internal Sequelize representation.
   *
   * @param repr The internal Sequelize query.
   */
  constructor(repr: AnyWhereOptions) {
    this.repr = repr;
  }

  /**
   * Construct a where query from AND'ing two queries together.
   *
   * @param other The other where query to AND with.
   * @returns The new where query.
   */
  and(other: Where): Where {
    return new Where(cloner.deep.merge({}, this.compile(), other.compile()));
  }

  /**
   * Construct a where query from OR'ing two queries together.
   *
   * @param other The other where query to OR with.
   * @returns The new where query.
   */
  or(other: Where): Where {
    return new Where({
      [Op.or]: [this.compile(), other.compile()],
    });
  }

  /**
   * Compile a where query to its internal Sequelize representation.
   *
   * @returns The compiled where query.
   */
  compile(): AnyWhereOptions {
    return this.repr;
  }
}
