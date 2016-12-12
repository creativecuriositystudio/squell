/** Contains the database connection class. */
import * as Bluebird from 'bluebird';
import * as _ from 'lodash';
import 'reflect-metadata';
import { DestroyOptions, DropOptions, Options as SequelizeOptions,
         Sequelize as Connection, SyncOptions, Transaction,
       } from 'sequelize';

import * as Sequelize from 'sequelize';

import { Attribute, PlainAttribute } from './attribute';
import { ATTR_OPTIONS_META_KEY, Model, MODEL_ATTR_KEYS_META_KEY, MODEL_OPTIONS_META_KEY } from './model';
import { Query } from './query';

/**
 * The database connection, wrapping a Sequelize connection.
 * All models defined on a connection before they can be used
 * for querying a database, as the models are defined separately
 * to the database via extending the abstract model class.
 */
export class Database {
  /** The Sequelize connection. */
  public conn: Connection;

  /**
   * Connect to a database using Sequelize.
   *
   * @param url The database URL/URI.
   * @param options Any additional Sequelize options, e.g. connection pool count.
   */
  constructor(url: string, options?: SequelizeOptions) {
    this.conn = new Sequelize(url, options);
  }

  /**
   * Define a Squell model on this connection.
   * Without doing this, the model cannot be queried.
   *
   * @see sync
   */
  public define<T extends Model>(model: typeof Model): Database {
    let name = this.getModelName(model);

    // Only define the model on the connection once.
    if (this.conn.isDefined(name)) {
      return this;
    }

    let attrs = this.getModelAttributes(model);
    let options = this.getModelOptions(model);

    this.conn.define<T, T>(name, attrs, options);

    return this;
  }

  /**
   * Sync all defined model tables to the database using Sequelize.
   *
   * @param options Extra Sequelize sync options, if required.
   * @returns A promise that resolves when the table syncing is completed.
   */
  public sync(options?: SyncOptions): Bluebird<any> {
    return this.conn.sync(options);
  }

  /**
   * Drop all defined model tables from the database.
   *
   * @param options
   * @returns Returns a promise that resolves when the table dropping is completed.
   */
  public drop(options?: DropOptions): Bluebird<any> {
    return this.conn.drop(options);
  }

  /**
   * Truncate all defined model tables in the database.
   *
   * @param options Extra Sequelize truncate options, if required.
   */
  public truncate(options?: DestroyOptions): Bluebird<any> {
    return this.conn.truncate(options);
  }

  /**
   * Creates a transaction and passes it to a callback, working
   * exactly the same as the Sequelize function of the same name.
   *
   * @param cb The callback that will be passed the transaction and should return a promise using
   *           the transaction.
   * @returns The promise result that resolves when the transaction is completed.
   */
  public transaction(cb: (tx: Transaction) => Bluebird<any>): Bluebird<any> {
    return this.conn.transaction(cb);
  }

  /**
   * Close the database connection.
   * Once closed, the database cannot be queried again.
   */
  public close() {
    this.conn.close();
  }

  /**
   * Start a query on a specific model.
   *
   * @param model The model class to query. This must have been defined on the database first.
   * @returns A new query of the model.
   */
  public query<T extends Model>(model: typeof Model & { new(): T }): Query<T> {
    return new Query<T>(model, this.getModel<T>(model));
  }

  /**
   * Get the internal Sequelize representation for a Squell model.
   *
   * @throws Error
   * @param model The model class to fetch. This must have been defined on the database first,
   *              otherwise an exception is thrown.
   * @returns The internal Sequelize representation of the model.
   */
  public getModel<T extends Model>(model: typeof Model): Sequelize.Model<T, T> {
    let name = this.getModelName(model);

    // Don't continue if there's no model defined yet.
    if (!this.conn.isDefined(name)) {
      throw Error('A model must be defined before querying it');
    }

    return this.conn.model<T, T>(name);
  }

  /**
   * Get the model primary attribute.
   *
   * @throws Error
   * @param model The model class to get the primary attribute for. The model must have been decorated with @model,
   *              otherwise an exception is thrown.
   * @returns The model primary attribute.
   */
  public getModelPrimary<T, U extends Model>(model: typeof Model & { new(): U }): Attribute<T> {
    // FIXME: Wish we didn't have to cast any here, but primaryKeyAttribute isn't exposed
    // by the Sequelize type definitions.
    return new PlainAttribute<T>((this.getModel<U>(model) as any).primaryKeyAttribute);
  }

  /**
   * Get the model options stored using the @model decorator from a model class.
   *
   * @throws Error
   * @param model The model class to get the options for. The model must have been decorated with @model,
   *              otherwise an exception is thrown.
   * @returns The model options.
   */
  public getModelOptions(model: typeof Model): any {
    let options = Reflect.getMetadata(MODEL_OPTIONS_META_KEY, model);

    // We need a model name set to continue.
    if (!options) {
      throw new Error('Model classes must be decorated using the @model decorator');
    }

    return options;
  }

  /**
   * Get the model attributes stored using the @attr decorator from a model class.
   *
   * @throws Error
   * @param model The model class to get the attributes for. The model must have been decorated with @model,
   *              otherwise an exception is thrown.
   * @returns The model options.
   */
  public getModelAttributes(model: typeof Model): any {
    // Get the list of keys and then map them into the model attributes defintion
    // format Sequelize expects.
    let keys: string[] = Reflect.getMetadata(MODEL_ATTR_KEYS_META_KEY, model.prototype);

    // We need model attributes.
    if (!keys) {
      throw new Error('Model classes must have at least one property decorated using the @attr decorator');
    }

    return _.chain(keys)
      .map((x) => [x, Reflect.getMetadata(ATTR_OPTIONS_META_KEY, model.prototype, x)])
      .fromPairs()
      .value();
  }

  /**
   * Get the model name stored using the model decorator from a model class.
   *
   * @throws Error
   * @param model The model class to get the name for. The model must have been decorated with @model,
   *              otherwise an exception is thrown.
   * @returns The model name.
   */
  public getModelName(model: typeof Model): string {
    let options = this.getModelOptions(model);

    // We need a model name set to continue.
    if (!options.modelName) {
      throw new Error('Model class names must be set using the @model decorator');
    }

    return options.modelName;
  }
}
