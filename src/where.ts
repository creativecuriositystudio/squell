/** Contains the where class. */
import _ from 'lodash';
import { WhereOptions } from 'sequelize';

/**
 * Represents a type-safe where query that maps directly to a Sequelize query.
 */
export class Where {
  /** The Sequelize representation of the where query. */
  private repr: WhereOptions;

  /**
   * Construct a where query from an internal Sequelize representation.
   *
   * @param repr The internal Sequelize query.
   */
  constructor(repr: WhereOptions) {
    this.repr = repr;
  }

  /**
   * Construct a where query from AND'ing two queries together.
   *
   * @param other The other where query to AND with.
   * @returns The new where query.
   */
  public and(other: Where): Where {
    return new Where(_.extend({}, this.compile(), {
      $and: other.compile(),
    }));
  }

  /**
   * Construct a where query from OR'ing two queries together.
   *
   * @param other The other where query to OR with.
   * @returns The new where query.
   */
  public or(other: Where): Where {
    return new Where({
      $or: [this.compile(), other.compile()],
    });
  }

  /**
   * Compile a where query to its internal Sequelize representation.
   *
   * @returns The compiled where query.
   */
  public compile(): WhereOptions {
    return this.repr;
  }
}
