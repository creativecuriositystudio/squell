/** Contains the where class. */
import * as _ from 'lodash';
import { WhereOptions } from 'sequelize';

/**
 * Represents a type-safe where query that maps directly to a Sequelize query.
 */
export class Where {
  /** The Sequelize representation of the where query. */
  private repr: WhereOptions<any>;

  /**
   * Construct a where query from an internal Sequelize representation.
   *
   * @param repr The internal Sequelize query.
   */
  constructor(repr: WhereOptions<any>) {
    this.repr = repr;
  }

  /**
   * Construct a where query from AND'ing two queries together.
   *
   * @param other The other where query to AND with.
   * @returns The new where query.
   */
  and(other: Where): Where {
    return new Where(_.merge({}, this.compile(), other.compile()));
  }

  /**
   * Construct a where query from OR'ing two queries together.
   *
   * @param other The other where query to OR with.
   * @returns The new where query.
   */
  or(other: Where): Where {
    return new Where({
      $or: [this.compile(), other.compile()],
    });
  }

  /**
   * Compile a where query to its internal Sequelize representation.
   *
   * @returns The compiled where query.
   */
  compile(): WhereOptions<any> {
    return this.repr;
  }
}
