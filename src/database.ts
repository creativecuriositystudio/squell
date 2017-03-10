/** Contains the database connection class. */
import 'reflect-metadata';
import * as _ from 'lodash';
import * as Sequelize from 'sequelize';
import { Model, ModelConstructor, Safe, AssociationType, AttributeType, InternalAttributeType,
         ArrayAttributeTypeOptions, EnumAttributeTypeOptions,
         getModelOptions, getAttributes, getAssociations,
         HAS_ONE, HAS_MANY, BELONGS_TO, BELONGS_TO_MANY } from 'modelsafe';
import { DestroyOptions, DropOptions, Options as SequelizeOptions,
         Sequelize as Connection, SyncOptions, Transaction, Model as SequelizeModel,
         DefineOptions, DefineAttributeColumnOptions, DefineAttributes,
         DataTypeAbstract, STRING, CHAR, TEXT, INTEGER, BIGINT, FLOAT,
         REAL, DOUBLE, DECIMAL, BOOLEAN, TIME, DATE, JSON, JSONB,
         BLOB, ENUM, ARRAY
       } from 'sequelize';

import { Attribute, PlainAttribute } from './attribute';
import { getModelOptions as getSquellOptions, getAttributeOptions, getAssociationOptions } from './metadata';
import { Query } from './query';

/**
 * Map a ModelSafe attribute type to a Sequelize data type.
 *
 * @param type The attribute type.
 * @returns The Sequelize data type, or null if no equivalent type was found.
 */
function mapType(type: AttributeType): DataTypeAbstract {
  switch (type.type) {
  case InternalAttributeType.STRING: return STRING;
  case InternalAttributeType.CHAR: return CHAR;
  case InternalAttributeType.TEXT: return TEXT;
  case InternalAttributeType.INTEGER: return INTEGER;
  case InternalAttributeType.BIGINT: return BIGINT;
  case InternalAttributeType.FLOAT: return FLOAT;
  case InternalAttributeType.REAL: return REAL;
  case InternalAttributeType.DOUBLE: return DOUBLE;
  case InternalAttributeType.DECIMAL: return DECIMAL;
  case InternalAttributeType.BOOLEAN: return BOOLEAN;
  case InternalAttributeType.TIME: return TIME;
  case InternalAttributeType.DATE: return DATE;
  case InternalAttributeType.JSON: return JSON;
  case InternalAttributeType.JSONB: return JSONB;
  case InternalAttributeType.BLOB: return BLOB;
  case InternalAttributeType.ENUM: {
    if (!type.options || !(<EnumAttributeTypeOptions> type.options).values) {
      return null;
    }

    return ENUM.apply(ENUM, (<EnumAttributeTypeOptions> type.options).values);
  }

  case InternalAttributeType.ARRAY: {
    if (!type.options || !(<ArrayAttributeTypeOptions> type.options).contained) {
      return null;
    }

    return ARRAY(mapType((<ArrayAttributeTypeOptions> type.options).contained));
  }

  default: return null;
  }
}

/**
 * The database connection, wrapping a Sequelize connection.
 * All models defined on a connection before they can be used
 * for querying a database, as the models are defined separately
 * to the database via extending the abstract model class.
 */
export class Database extends Safe {
  /** The Sequelize connection. */
  public conn: Connection;

  /**
   * The internal Sequelize models.
   * This should act like the models property existing
   * on a safe, except map to the internal Sequelize model
   * instead of a ModelSafe model.
   *
   * This will not be populated until synced.
   */
  protected internalModels: { [index: string]: SequelizeModel<any, any>; };

  /**
   * Connect to a database using Sequelize.
   *
   * @param url The database URL/URI.
   * @param options Any additional Sequelize options, e.g. connection pool count.
   */
  constructor(url: string, options?: SequelizeOptions) {
    super();

    this.conn = new Sequelize(url, options);
    this.internalModels = {};
  }

  /**
   * Sync all defined model tables to the database using Sequelize.
   *
   * @param options Extra Sequelize sync options, if required.
   * @returns A promise that resolves when the table syncing is completed.
   */
  public async sync(options?: SyncOptions): Promise<any> {
    // Translate the ModelSafe model into Sequelize form.
    for (let name of Object.keys(this.models)) {
      let model = this.models[name];
      let attrs = getAttributes(model);
      let mappedAttrs: DefineAttributes = {};
      let mappedOptions = { ... getSquellOptions(model) };

      for (let key of Object.keys(attrs)) {
        let attrOptions = attrs[key];
        let mappedType = mapType(attrOptions.type);

        if (typeof (mappedType) === 'undefined') {
          return Promise.reject(new Error(`Cannot define the ${name} model without a type on the ${key} attribute`));
        }

        let mappedAttr: DefineAttributeColumnOptions = {
          type: mappedType,

          ... getAttributeOptions(model, key)
        };

        if (!attrOptions.optional) {
          mappedAttr.allowNull = false;
        }

        if (attrOptions.primary) {
          mappedAttr.primaryKey = true;

          delete mappedAttr.allowNull;
        }

        if (attrOptions.unique) {
          mappedAttr.unique = true;
        }

        mappedAttrs[key] = mappedAttr;
      }

      this.internalModels[name] = this.conn.define<any, any>(name, mappedAttrs, mappedOptions) as SequelizeModel<any, any>;
    }

    // Associate the Sequelize models as a second-step.
    // We do this separately because we want all models
    // defined before we attempt to associate them.
    for (let name of Object.keys(this.models)) {
      let model = this.models[name];
      let internalModel = this.internalModels[name];
      let modelOptions = getModelOptions(model);
      let assocs = getAssociations(model);

      for (let key of Object.keys(assocs)) {
        let assocOptions = assocs[key];
        let type = assocOptions.type;
        let target = assocOptions.target;

        if (typeof (type) === 'undefined') {
          return Promise.reject(new Error(`Cannot associate the ${name} model without a type for association ${key}`));
        }

        if (!target) {
          return Promise.reject(new Error(`Cannot associate the ${name} model without a target for association ${key}`));
        }

        let targetOptions = getModelOptions(target);
        let targetModel = this.internalModels[targetOptions.name];
        let mappedAssoc = {
          as: key,
          through: _.camelCase(modelOptions.name + targetOptions.name),

          ... getAssociationOptions(model, key)
        };

        switch (type) {
        case HAS_ONE: internalModel.hasOne(targetModel, mappedAssoc); break;
        case HAS_MANY: internalModel.hasMany(targetModel, mappedAssoc); break;
        case BELONGS_TO: internalModel.belongsTo(targetModel, mappedAssoc); break;
        case BELONGS_TO_MANY: internalModel.belongsToMany(targetModel, mappedAssoc); break;
        }
      }
    }

    return Promise.resolve(this.conn.sync(options));
  }

  /**
   * Drop all defined model tables from the database.
   *
   * @param options
   * @returns Returns a promise that resolves when the table dropping is completed.
   */
  public async drop(options?: DropOptions): Promise<any> {
    return Promise.resolve(this.conn.drop(options));
  }

  /**
   * Truncate all defined model tables in the database.
   *
   * @param options Extra Sequelize truncate options, if required.
   */
  public async truncate(options?: DestroyOptions): Promise<any> {
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
  public async transaction(cb: (tx: Transaction) => Promise<any>): Promise<any> {
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
   * Start a query on a specific model. The model must have
   * been defined and the database synced for the query to be performed.
   *
   * @param model The model class to query.
   * @returns A new query of the model.
   */
  public query<T extends Model>(model: ModelConstructor<T>): Query<T> {
    return new Query<T>(this, model);
  }

  /**
   * Get the internal Sequelize model for a ModelSafe model.
   * Throws an error if the model has not been decorated correctly using
   * the ModelSafe decorators.
   *
   * @throws Error
   * @param model The model constructor.
   * @returns The internal Sequelize model.
   */
  public getInternalModel<T extends Model>(model: ModelConstructor<T>): SequelizeModel<T, T> {
    let options = getModelOptions(model);
    let internalModel = this.internalModels[options.name] as SequelizeModel<T, T>;

    if (!internalModel) {
      throw new Error('The database must be synced and a model must be defined before it can be queried');
    }

    return internalModel;
  }

  /**
   * Get the internal Sequelize model's primary attribute.
   * Throws an error if the model has not been decorated correctly using
   * the ModelSafe decorators.
   *
   * @throws Error
   * @param model The model class to get the primary attribute for.
   *              The model must be defined on the database before it can be queried.
   */
  public getInternalModelPrimary<T, U extends Model>(model: ModelConstructor<U>): Attribute<T> {
    // FIXME: Wish we didn't have to cast any here, but primaryKeyAttribute isn't exposed
    // by the Sequelize type definitions.
    return new PlainAttribute<T>((this.getInternalModel<U>(model) as any).primaryKeyAttribute);
  }
}
