/** Contains the database connection class. */
import * as _ from 'lodash';
import 'reflect-metadata';
import { DestroyOptions, DropOptions, Options as SequelizeOptions,
         Sequelize as Connection, SyncOptions, Transaction,
         DefineOptions, DefineAttributeColumnOptions, DefineAttributes
       } from 'sequelize';

import * as Sequelize from 'sequelize';

import { Attribute, PlainAttribute } from './attribute';
import { ATTR_OPTIONS_META_KEY, Model, ModelConstructor, MODEL_ATTR_KEYS_META_KEY, MODEL_OPTIONS_META_KEY,
         ASSOC_OPTIONS_META_KEY, MODEL_ASSOC_KEYS_META_KEY, Associations } from './model';
import { Query } from './query';

/** The definition of a specific model attribute. */
export type ModelAttrDefinition = Partial<DefineAttributeColumnOptions>;

/** The definition of a specific model association. */
export type ModelAssocDefinition<T> = {
  model: ModelConstructor<T>,
  options: any,
  type: Associations
};

/** The model attribute definitions. */
export type ModelAttrDefinitions = { [index: string]: ModelAttrDefinition };

/** The model association definitions. */
export type ModelAssocDefinitions = {
  [index: string]: ModelAssocDefinition<any>
};

/**
 * The representation FTP Host: ftp://ftp.mcandrewgroup.com.au
Username: mdadmin
Password: Bygs264sof a defined model on the database.
 */
interface ModelRecord<T extends Model> {
  /** The model class. */
  model: ModelConstructor<T>;

  /** The internal Sequelize model. */
  internalModel: Sequelize.Model<T, T>;
  options: DefineOptions<T>;

  /** The model attribute definitions. */
  attrs: ModelAttrDefinitions;

  /** The model association definitions. */
  assocs: ModelAssocDefinitions;

  /** Whether or not the model as been associated to other models yet. */
  isAssociated: boolean;
};

/**
 * The database connection, wrapping a Sequelize connection.
 * All models defined on a connection before they can be used
 * for querying a database, as the models are defined separately
 * to the database via extending the abstract model class.
 */
export class Database {
  /** The Sequelize connection. */
  public conn: Connection;

  /** Indicates whether all of the defined models have had their associations created */
  public isAssociated: boolean;

  /** A record of all models defined on the database. */
  private models: { [index: string]: ModelRecord<any>; };

  /**
   * Connect to a database using Sequelize.
   *
   * @param url The database URL/URI.
   * @param options Any additional Sequelize options, e.g. connection pool count.
   */
  constructor(url: string, options?: SequelizeOptions) {
    this.conn = new Sequelize(url, options);
    this.models = {};
    this.isAssociated = false;
  }

  /**
   * Define a Squell model on this connection.
   * Without doing this, the model cannot be queried.
   *
   * @see sync
   */
  public define<T extends Model>(model: ModelConstructor<T>): Database {
    let name = this.getModelName(model);

    // Only define the model on the connection once.
    if (this.conn.isDefined(name)) {
      return this;
    }

    this.isAssociated = false;

    let options = this.getModelOptions(model);
    let attrs = this.getModelAttributes(model);
    let assocs = this.getModelAssociations(model);

    let internalModel = this.conn.define<T, T>(name, attrs as DefineAttributes, options);

    this.models[name] = {
        model,
        internalModel,
        options,
        attrs,
        assocs,
        isAssociated: false,
    };

    return this;
  }

  /**
   * Create the associations on each of the newly defined models.
   * This must be called only after all of the associated models
   * have been defined.
   *
   * This is called automatically by sync.
   *
   * @see sync
   */
  public associate(): Database {
    if (this.isAssociated) {
      return this;
    }

    _.each(this.models, (model, modelName) => {
      if (model.isAssociated) {
        return;
      }

      _.each(model.assocs, (assoc, assocName) => {
        let target = this.getModel(assoc.model);

        switch (assoc.type) {
          case Associations.HAS_ONE: model.internalModel.hasOne(target, assoc.options); break;
          case Associations.HAS_MANY: model.internalModel.hasMany(target, assoc.options); break;
          case Associations.BELONGS_TO: model.internalModel.belongsTo(target, assoc.options); break;
          case Associations.BELONGS_TO_MANY: model.internalModel.belongsToMany(target, assoc.options); break;
        }

      });
    });

    this.isAssociated = false;

    return this;
  }

  /**
   * Sync all defined model tables to the database using Sequelize.
   *
   * @param options Extra Sequelize sync options, if required.
   * @returns A promise that resolves when the table syncing is completed.
   */
  public sync(options?: SyncOptions): Promise<any> {
    this.associate();

    return Promise.resolve(this.conn.sync(options));
  }

  /**
   * Drop all defined model tables from the database.
   *
   * @param options
   * @returns Returns a promise that resolves when the table dropping is completed.
   */
  public drop(options?: DropOptions): Promise<any> {
    return Promise.resolve(this.conn.drop(options));
  }

  /**
   * Truncate all defined model tables in the database.
   *
   * @param options Extra Sequelize truncate options, if required.
   */
  public truncate(options?: DestroyOptions): Promise<any> {
    return Promise.resolve(this.conn.truncate(options));
  }

  /**
   * Creates a transaction and passes it to a callback, working
   * exactly the same as the Sequelize function of the same name.
   *
   * @param cb The callback that will be passed the transaction and should return a promise using
   *           the transaction.
   * @returns The promise result that resolves when the transaction is completed.
   */
  public transaction(cb: (tx: Transaction) => Promise<any>): Promise<any> {
    // FIXME: Kinda hacky, but we cast any here so that we don't have to have
    // the Bluebird dependency just for this single function. The promise
    // should behave exactly the same as a Bluebird promise.
    return Promise.resolve(this.conn.transaction(cb as any));
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
  public query<T extends Model>(model: ModelConstructor<T>): Query<T> {
    return new Query<T>(this, model);
  }

  /**
   * Get the internal Sequelize representation for a Squell model.
   *
   * @throws Error
   * @param model The model class to fetch. This must have been defined on the database first,
   *              otherwise an exception is thrown.
   * @returns The internal Sequelize representation of the model.
   */
  public getModel<T extends Model>(model: ModelConstructor<T>): Sequelize.Model<T, T> {
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
  public getModelPrimary<T, U extends Model>(model: ModelConstructor<U>): Attribute<T> {
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
  public getModelOptions<T extends Model>(model: ModelConstructor<T>): any {
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
  public getModelAttributes<T extends Model>(model: ModelConstructor<T>): ModelAttrDefinitions {
    // Get the list of keys and then map them into the model attributes definition
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
   * Get the model associations stored using the @assoc decorators on a model's properties.
   *
   * @throws Error
   * @param model The model class to get the associations for. The model must have been decorated with @model,
   *              otherwise an exception is thrown.
   * @returns The model options.
   */
  public getModelAssociations<T extends Model>(model: ModelConstructor<T>): ModelAssocDefinitions {
    // Get the list of keys and then map them into the model attributes definition
    // format Sequelize expects.
    let keys: string[] = Reflect.getMetadata(MODEL_ASSOC_KEYS_META_KEY, model.prototype);

    return _.chain(keys)
      .map((x) => [x, Reflect.getMetadata(ASSOC_OPTIONS_META_KEY, model.prototype, x)])
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
  public getModelName<T extends Model>(model: ModelConstructor<T>): string {
    let options = this.getModelOptions(model);

    // We need a model name set to continue.
    if (!options.modelName) {
      throw new Error('Model class names must be set using the @model decorator');
    }

    return options.modelName;
  }
}
