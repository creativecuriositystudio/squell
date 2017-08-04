/** Contains the database connection class. */
import 'reflect-metadata';
import * as Sequelize from 'sequelize';
import * as _ from 'lodash';
import { Model, ModelConstructor, AttributeType, InternalAttributeType, AssociationType,
         ArrayAttributeTypeOptions, EnumAttributeTypeOptions, isLazyLoad,
         getModelOptions, getAttributes, getAssociations, AssociationTarget,
         HAS_ONE, HAS_MANY, BELONGS_TO, BELONGS_TO_MANY } from 'modelsafe';
import { DestroyOptions, DropOptions, Options as SequelizeOptions,
         Sequelize as Connection, SyncOptions, Transaction, Model as SequelizeModel,
         DefineAttributeColumnOptions, DefineAttributes,
         DataTypeAbstract, STRING, CHAR, TEXT, INTEGER, BIGINT,
         DOUBLE, BOOLEAN, TIME, DATE, JSON, BLOB, ENUM, ARRAY,
         AssociationOptionsBelongsToMany as SequelizeAssociationOptionsBelongsToMany
       } from 'sequelize';

import { Queryable, attribute } from './queryable';
import { getModelOptions as getSquellOptions, getAttributeOptions,
         getAssociationOptions, AssociationOptionsBelongsToMany, ThroughOptions } from './metadata';
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
  case InternalAttributeType.REAL: return DOUBLE;
  case InternalAttributeType.BOOLEAN: return BOOLEAN;
  case InternalAttributeType.TIME: return TIME;
  case InternalAttributeType.DATE: return DATE;
  case InternalAttributeType.OBJECT: return JSON;
  case InternalAttributeType.BLOB: return BLOB;
  case InternalAttributeType.ENUM: {
    if (!type.options || !(type.options as EnumAttributeTypeOptions).values) {
      return null;
    }

    return ENUM.apply(ENUM, (type.options as EnumAttributeTypeOptions).values);
  }

  case InternalAttributeType.ARRAY: {
    if (!type.options || !(type.options as ArrayAttributeTypeOptions).contained) {
      return null;
    }

    return ARRAY(mapType((type.options as ArrayAttributeTypeOptions).contained));
  }

  default: return null;
  }
}

interface AssocOptions {
  type: AssociationType;
  model: string;
  as: string;
  target: string;
  foreignKey: string | { name: string };
}

/**
 * The database connection, wrapping a Sequelize connection.
 * All models defined on a connection before they can be used
 * for querying a database, as the models are defined separately
 * to the database via extending the abstract model class.
 */
export class Database {
  /** The Sequelize connection. */
  conn: Connection;

  /** The ModelSafe models to be used with Sequelize. */
  protected models: { [key: string]: ModelConstructor<Model>; };

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
    this.conn = new Sequelize(url, options);
    this.models = {};
    this.internalModels = {};
  }

  /**
   * Checks if a ModelSafe model has already been defined on the database.
   *
   * @param model The model constructor.
   * @returns Whether the model has been defined on the database.
   */
  isDefined<T extends Model>(model: ModelConstructor<T>): boolean {
    let options = getModelOptions(model);

    return options.name && !!this.models[options.name];
  }

  /**
   * Define a ModelSafe model on the database.
   * A model must be defined on the database in order for it
   * to be synced to the database and then queried.
   *
   * @param model The model constructor.
   * @returns The database with the model defined, allowing for chaining definition calls.
   *          The database is still mutated.
   */
  define<T extends Model>(model: ModelConstructor<T>): Database {
    let options = getModelOptions(model);

    // We need a model name in order to use the provided model
    if (!options.name) {
      throw new Error('Models must have a model name and be decorated with @model to be defined on a safe');
    }

    // Only define a model once
    if (this.isDefined(model)) {
      return this;
    }

    this.models[options.name] = model;

    return this;
  }

  /**
   * Sync all defined model tables to the database using Sequelize.
   *
   * @param options Extra Sequelize sync options, if required.
   * @returns A promise that resolves when the table syncing is completed.
   */
  async sync(options?: SyncOptions): Promise<any> {
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
          throw new Error(`Cannot define the ${name} model without a type on the ${key} attribute`);
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
      let assocs = getAssociations(model);

      const allAssocs = Object.keys(assocs).map(key => {
        let assocOptions = assocs[key];
        let type = assocOptions.type;
        let target = assocOptions.target;

        if (isLazyLoad(target)) {
          target = (target as () => ModelConstructor<any>)();
        }

        if (typeof (type) === 'undefined') {
          throw new Error(`Cannot associate the ${name} model without a type for association ${key}`);
        }

        if (!target) {
          throw new Error(`Cannot associate the ${name} model without a target for association ${key}`);
        }

        let targetOptions = getModelOptions(target);

        if (!targetOptions.name) {
          throw new Error(`Cannot associate the ${name} model without a correctly decorated target for association ${key}`);
        }

        let targetModel = this.internalModels[targetOptions.name];
        let mappedAssoc = {
          as: key,

          ... getAssociationOptions(model, key)
        };

        if (type === HAS_ONE && !mappedAssoc.foreignKey) mappedAssoc.foreignKey = name + 'Id';

        if (type === BELONGS_TO_MANY) {
          let manyAssoc = mappedAssoc as AssociationOptionsBelongsToMany;
          let through = manyAssoc.through;

          // FIXME: Don't throw here and make it required somehow during decoration
          // Not currently possible because there is one @assoc decorator
          // and not a separate one for belongs to many.
          if (typeof (through) === 'undefined') {
            throw new Error(`Cannot associate the ${name} model without a decorated through for association ${key}`);
          }

          if (typeof (through) !== 'string') {
            let throughModel = through;
            let throughObj: ThroughOptions = { model: null, unique: true };

            // Check if it looks like a through options object
            if (_.isPlainObject(through)) {
              throughModel = (through as ThroughOptions).model;
              throughObj = {
                ... throughObj,
                ... _.pick(through, ['scope', 'unique']) as ThroughOptions
              };
            }

            // Check if it's a lazy-loadable association target
            if (isLazyLoad(throughModel as AssociationTarget<any>)) {
              throughModel = (throughModel as () => ModelConstructor<any>)();
            }

            let throughOptions;

            // FIXME: Test this in a better way somehow
            try {
              throughOptions = getModelOptions(throughModel as ModelConstructor<any>);
            } catch (err) {
              // Not a ModelSafe model
              throughOptions = {};
            }

            // Rejig to use the already defined internal model if it's a ModelSafe model
            // If it's a Sequelize model we leave as-is
            if (throughOptions.name) {
              let internalThroughModel = this.internalModels[throughOptions.name];

              // If there's no internal model, they haven't called `define`.
              if (!internalThroughModel) {
                throw new Error(`Cannot associate the ${name} model without a database-defined through for association ${key}`);
              }

              throughModel = internalThroughModel;
            }

            throughObj.model = throughModel as SequelizeModel<any, any>;
            manyAssoc.through = throughObj;
          }
        }

        switch (type) {
        case HAS_ONE: internalModel.hasOne(targetModel, mappedAssoc); break;
        case HAS_MANY: internalModel.hasMany(targetModel, mappedAssoc); break;
        case BELONGS_TO: internalModel.belongsTo(targetModel, mappedAssoc); break;

        // FIXME: Any cast required because our belongs to many options aren't type equivalent (but function the same)
        case BELONGS_TO_MANY:
          internalModel.belongsToMany(targetModel, mappedAssoc as any as SequelizeAssociationOptionsBelongsToMany);

          break;
        }

        return {
          type,
          model: name,
          target: targetOptions.name,
          ...mappedAssoc,
        } as AssocOptions;
      });

      // Check for duplicate foreign keys on the same model
      const hasOnes = _.filter(allAssocs, _ => _.type === HAS_ONE);
      const duplicates = _.xor(hasOnes,
        _.uniqWith(hasOnes,
          (a: AssocOptions, b: AssocOptions) =>
            a.model === b.model &&
            a.target === b.target &&
            (_.isObject(a.foreignKey) ? (a.foreignKey as any).name : a.foreignKey) ===
            (_.isObject(b.foreignKey) ? (b.foreignKey as any).name : b.foreignKey)
        )) as AssocOptions[];

      if (duplicates.length) {
        throw new Error('Duplicate foreign keys found:\n' +
          duplicates.map(_ => `  ${_.model}.${_.as} -> ${_.target}.${_.foreignKey || (_.foreignKey as any).name}`).join('\n') +
          '\nSpecify non-conflicting foreign keys on the associations');
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
  async drop(options?: DropOptions): Promise<any> {
    return Promise.resolve(this.conn.drop(options));
  }

  /**
   * Truncate all defined model tables in the database.
   *
   * @param options Extra Sequelize truncate options, if required.
   */
  async truncate(options?: DestroyOptions): Promise<any> {
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
  async transaction(cb: (tx: Transaction) => Promise<any>): Promise<any> {
    // FIXME: Kinda hacky, but we cast any here so that we don't have to have
    // the Bluebird dependency just for this single function. The promise
    // should behave exactly the same as a Bluebird promise.
    return Promise.resolve(this.conn.transaction(cb as any));
  }

  /**
   * Close the database connection.
   * Once closed, the database cannot be queried again.
   */
  close() {
    this.conn.close();
  }

  /**
   * Start a query on a specific model. The model must have
   * been defined and the database synced for the query to be performed.
   *
   * @param model The model class to query.
   * @returns A new query of the model.
   */
  query<T extends Model>(model: ModelConstructor<T>): Query<T> {
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
  getInternalModel<T extends Model>(model: ModelConstructor<T>): SequelizeModel<T, T> {
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
  getInternalModelPrimary<T, U extends Model>(model: ModelConstructor<U>): Queryable<T> {
    // FIXME: Wish we didn't have to cast any here, but primaryKeyAttribute isn't exposed
    // by the Sequelize type definitions.
    return attribute((this.getInternalModel<U>(model) as any).primaryKeyAttribute);
  }
}
