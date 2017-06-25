/** Contains the type-safe querying interface that wraps Sequelize queries. */
import * as _ from 'lodash';
import { Model, ModelConstructor, ModelErrors, ValidationError, isLazyLoad,
         getAttributes as getModelAttributes,
         getAssociations as getModelAssociations } from 'modelsafe';
import { FindOptions, WhereOptions, BelongsToAssociation,
         FindOptionsAttributesArray, DestroyOptions, RestoreOptions,
         CountOptions, AggregateOptions, CreateOptions as SequelizeCreateOptions,
         UpdateOptions as SequelizeUpdateOptions,
         BulkCreateOptions, UpsertOptions, FindOrInitializeOptions,
         IncludeOptions, Utils, ValidationError as SequelizeValidationError,
         Model as SequelizeModel, Transaction, TruncateOptions, DropOptions, Instance
       } from 'sequelize';

import { Queryable, AttributeQueryable, AssociationQueryable, ModelQueryables } from './queryable';
import { getAssociationOptions } from './metadata';
import { Where } from './where';
import { Database } from './database';

/** A type alias for a sorting order. */
export type Order = string;

/** Represents descending order. */
export const DESC: Order = 'DESC';

/** Represents ascending order. */
export const ASC: Order  = 'ASC';

/** Represents the ordering of a queryable. */
export type QueryableOrder<T> = [Queryable<T>, Order];

/**
 * Query options for a Squell query.
 */
export interface QueryOptions {
  /** The array of where queries for the query. */
  wheres: Where[];

  /** The array of attribute filters for the query. */
  attrs: Queryable<any>[];

  /** The array of association filters for the query. */
  includes: IncludeOptions[];

  /** The array of attribute orderings for the query. */
  orderings: QueryableOrder<any>[];

  /** The number of records to skip (i.e. OFFSET). */
  skipped: number;

  /** The number of records to take (i.e. LIMIT). */
  taken: number;
}

/** Extra options for updating model instances. */
export interface UpdateOptions extends SequelizeUpdateOptions {
  /** Whether or not to automatically update associated instances. */
  associate?: boolean;
}

/** Extra options for creating model instances. */
export interface CreateOptions extends SequelizeCreateOptions {
  /** Whether or not to automatically update associated instances. */
  associate?: boolean;
}

/**
 * Coerces a Sequelize validation error into ModelSafe's form.
 *
 * @param ctor The model constructor.
 * @param err The Sequelize validation error.
 * @returns The coerced error.
 */
function coerceValidationError<T extends Model>(
  ctor: ModelConstructor<T>,
  err: SequelizeValidationError
): ValidationError<T> {
  let errors = {};
  let attrs = getModelAttributes(ctor);
  let assocs = getModelAssociations(ctor);

  // Get all the errors for the specific attribute.
  for (let key of Object.keys(attrs)) {
    errors[key] = _.map(err.get(key), item => {
      return item.message;
    });
  }

  // Just set empty. We don't validate associations (yet).
  for (let key of Object.keys(assocs)) {
    errors[key] = [];
  }

  let result = new ValidationError<T>(ctor, err.message, errors as ModelErrors<T>);

  // Merge the stack.
  result.stack = `${result.stack}\ncaused by ${err.stack}`;

  return result;
}

/**
 * Coerces a ModelSafe model instance to a Sequelize model instance.
 *
 * @param internalModel The Sequelize model.
 * @param data The ModelSafe model instance or a partial object of values.
 * @returns The Sequelize model instance coerced.
 */
export async function coerceInstance<T extends Model>(internalModel: SequelizeModel<T, T>,
                                                      data: T | Partial<T>): Promise<Instance<T>> {
  if (!_.isPlainObject(data)) {
    data = await data.serialize();
  }

  return internalModel.build(data as T, { isNewRecord: false }) as any as Instance<T>;
}

/**
 * Get the queryable properties of a model as a mapped type.
 *
 * @param ctor The model constructor.
 * @returns The mapped queryable properties.
 */
function getQueryables<T extends Model>(ctor: ModelConstructor<T>): ModelQueryables<T> {
  let result = {};
  let attrs = getModelAttributes(ctor);
  let assocs = getModelAssociations(ctor);

  for (let key of Object.keys(attrs)) {
    result[key] = new AttributeQueryable(key);
  }

  for (let key of Object.keys(assocs)) {
    result[key] = new AssociationQueryable(key);
  }

  return result as ModelQueryables<T>;
}

/**
 * A type-safe query on a ModelSafe model.
 * This is the main interaction with the library, and every Squell query compiles
 * down to a relevant Sequelize query.
 */
export class Query<T extends Model> {
  /** The Squell database that generated the query relates to. */
  private db: Database;

  /** The model being queried. */
  private model: ModelConstructor<T>;

  /** The internal Sequelize representation of the model. */
  private internalModel: SequelizeModel<T, T>;

  /** The options for the query, include wheres, includes, etc. */
  private options: QueryOptions;

  /**
   * Construct a query. This generally should not be done by user code,
   * rather the query function on a database connection should be used.
   *
   * @param model The model class.
   * @param options The query options.
   */
  constructor(db: Database, model: ModelConstructor<T>, options?: QueryOptions) {
    this.db = db;
    this.model = model;
    this.internalModel = db.getInternalModel<T>(model);
    this.options = {
      wheres: [],
      skipped: 0,
      taken: 0,

      ... options
    };
  }

  /**
   * Filter a query using a where query.
   *
   * @param map A function that will take the queryable model properties
   *            and produce the where query to filter the query with.
   * @returns   The filtered query.
   */
  public where(map: (queryables: ModelQueryables<T>) => Where): Query<T> {
    let options = { ... this.options, wheres: this.options.wheres.concat(map(getQueryables(this.model))) };

    return new Query<T>(this.db, this.model, options);
  }

  /**
   * Select the attributes to be included in a query result.
   *
   * @param map A function that will take the queryable model properties
   *            and produce an array of attributes to be included in the result.
   * @returns The new query with the selected attributes only.
   */
  public attributes(map: (queryable: ModelQueryables<T>) => Queryable<any>[]): Query<T> {
    let attrs = this.options.attrs || [];
    let options = { ... this.options, attrs: attrs.concat(map(getQueryables(this.model))) };

    return new Query<T>(this.db, this.model, options);
  }

  /**
   * Eager load an association model with the query.
   * An optional function can be provided to change the query on the association
   * model in order to do things like where queries on association query.
   *
   * @param map A function that will take the queryable model properties
   *            and produce the attribute the association is under.
   * @param query A function that will take the default query on the association model
   *              and return a custom one, i.e. allows for adding where queries
   *              to the association query.
   * @returns The eagerly-loaded query.
   */
  public include<U extends Model>(model: ModelConstructor<U>,
                                  map: (queryables: ModelQueryables<T>) => Queryable<any> | [Queryable<any>, IncludeOptions],
                                  query?: (query: Query<U>) => Query<U>): Query<T> {
    let includes = this.options.includes || [];
    let attrResult = map(getQueryables(this.model));
    let assocKey;
    let extraOptions = {};
    let includeOptions = {
      model: this.db.getInternalModel(model)
    };

    if (Array.isArray(attrResult)) {
      let [assocAttr, assocIncludeOptions] = attrResult as [Queryable<any>, IncludeOptions];

      assocKey = assocAttr.compileLeft();
      extraOptions = assocIncludeOptions;
    } else {
      assocKey = (attrResult as Queryable<any>).compileLeft();
    }

    let assocOptions = getAssociationOptions(this.model, assocKey);

    includeOptions = {
      as: assocOptions && assocOptions.as ? assocOptions.as : assocKey,

      ... includeOptions,
      ... extraOptions
    };

    // If the association has been defined,
    // use the as option from there. This allows
    // users of the library to provide custom `as` options
    // and we can still query them correctly.
    if (query) {
      includeOptions = {
        ... query(new Query<U>(this.db, model)).compileFindOptions(),
        ... includeOptions
      };
    }

    let options = {
      ... this.options,

      includes: includes.concat([includeOptions])
    };

    return new Query<T>(this.db, this.model, options);
  }

  /**
   * Eager load all association models with the query.
   *
   * @returns The eagerly-loaded query.
   */
  public includeAll(): Query<T> {
    let query: Query<T> = this;
    const assocs = getModelAssociations(this.model);

    for (let key of Object.keys(assocs)) {
      let options = assocs[key];
      let target = options.target;

      // Lazily load the target if required.
      if (isLazyLoad(target)) {
        target = (target as () => ModelConstructor<any>)();
      }

      query = query.include(target as ModelConstructor<any>, _ => new AssociationQueryable(key));
    }

    return query;
  }

  /**
   * Order the future results of a query.
   *
   * @param map A function that will take the queryable model properties
   *            and produce an array of attribute orders for the result to be ordered by.
   * @returns    The ordered query.
   */
  public order(map: (queryables: ModelQueryables<T>) => QueryableOrder<any>[]): Query<T> {
    let orderings = this.options.orderings || [];
    let options = { ... this.options, orderings: orderings.concat(map(getQueryables(this.model))) };

    return new Query<T>(this.db, this.model, options);
  }

  /**
   * Skip a number of future results from the query.
   * This essentially increases the OFFSET amount,
   * and will only affect the find and findOne queries.
   */
  public skip(num: number): Query<T> {
    let options = { ... this.options, skipped: this.options.skipped + num };

    return new Query<T>(this.db, this.model, options);
  }

  /**
   * Take a number of future results from the query.
   * This increases the LIMIT amount and will affect find,
   * findOne, restore, destroy, aggregation and updates.
   */
  public take(num: number): Query<T> {
    let options = { ... this.options, taken: this.options.taken + num };

    return new Query<T>(this.db, this.model, options);
  }

  /**
   * Find a list of model instances using the built query.
   *
   * @param options Any extra Sequelize find options required.
   * @returns A promise that resolves to a list of found instances if successful.
   */
  public async find(options?: FindOptions): Promise<T[]> {
    let model = this.model;
    let data = await Promise.resolve(this.internalModel.findAll({ ... options, ... this.compileFindOptions() }));

    // Deserialize all returned Sequelize models
    return Promise.all<T>(data.map(async (item: T): Promise<T> => {
      // FIXME: The any cast is required here to turn the plain T into a Sequelize instance T
      return await model.deserialize((item as any as Instance<T>).toJSON(), { validate: false }) as T;
    }));
  }

  /**
   * Find a single model instance using the built query.
   *
   * @param options Any extra Sequelize find options required.
   * @returns A promise that resolves to the found instance if successful.
   */
  public async findOne(options?: FindOptions): Promise<T> {
    let data = await Promise.resolve(this.internalModel.findOne({ ... options, ... this.compileFindOptions() }));

    // FIXME: The any cast is required here to turn the plain T into a Sequelize instance T
    return data ?
      await this.model.deserialize((data as any as Instance<T>).toJSON(), { validate: false }) as T :
      null;
  }

  /**
   * Find a single model instance by a primary key/ID.
   *
   * @param id The primary key/ID value.
   * @param options Any extra Sequelize find options required.
   * @returns A promise that resolves to the found instance if successful.
   */
  public async findById(id: any, options?: FindOptions): Promise<T> {
    let data = await Promise.resolve(this.internalModel.findById(id, options));

    // FIXME: The any cast is required here to turn the plain T into a Sequelize instance T
    return data ?
      await this.model.deserialize((data as any as Instance<T>).toJSON(), { validate: false }) as T :
      null;
  }

  /**
   * Truncate the model table in the database.
   *
   * @param options Any extra truncate options to truncate with.
   * @returns A promise that resolves when the model table has been truncated.
   */
  public async truncate(options?: TruncateOptions): Promise<void> {
    return Promise.resolve(this.internalModel.truncate(options));
  }

  /**
   * Drop the model table in the database.
   *
   * @param options Any extra drop options to drop with.
   * @returns A promise that resolves when the model table has been dropped.
   */
  public async drop(options?: DropOptions): Promise<void> {
    return Promise.resolve(this.internalModel.drop(options));
  }

  /**
   * Restore deleted model instances to the database using
   * the built query. This will only work on paranoid deletion
   * models.
   *
   * @param options Any extra Sequelize restore options required.
   * @returns A promise that resolves when the instances have been restored successfully.
   */
  public async restore(options?: RestoreOptions): Promise<void> {
    return Promise.resolve(this.internalModel.restore({
      ... options,

      where: this.compileWheres(),
      limit: this.options.taken > 0 ? this.options.taken : undefined,
    }));
  }

  /**
   * Destroys model instances from the database using the
   * built query. This can destroy multiple instances if the query
   * isn't specific enough.
   *
   * @param options Any extra Sequelize destroy options required.
   * @returns A promise that resolves when the instances have been destroyed successfully.
   */
  public async destroy(options?: DestroyOptions): Promise<number> {
    return Promise.resolve(this.internalModel.destroy({
      ... options,

      where: this.compileWheres(),
      limit: this.options.taken > 0 ? this.options.taken : undefined,
    }));
  }

  /**
   * Counts the number of the model instances returned from the database
   * for the built query.
   *
   * @param options Any extra Sequelize count options required.
   * @returns A promise that resolves with the number of records found if successful.
   */
  public async count(options?: CountOptions): Promise<number> {
    return Promise.resolve(this.internalModel.count({
      ... options,

      where: this.compileWheres(),
    }));
  }

  /**
   * Aggregate the model instances in the database using a specific
   * aggregation function and model queryable.
   *
   * @param fn The aggregate function to use.
   * @param map A lambda function that will take the queryable model properties
   *            and produce the attribute to aggregate by.
   * @returns A promise that resolves with the aggregation value if successful.
   */
  public async aggregate(fn: string, map: (attrs: ModelQueryables<T>) => Queryable<any>,
                         options?: AggregateOptions): Promise<any> {
    return Promise.resolve(this.internalModel.aggregate(map(getQueryables(this.model)).compileLeft(), fn, {
      ... options,

      where: this.compileWheres(),
      limit: this.options.taken > 0 ? this.options.taken : undefined,
    }));
  }

  /**
   * Aggregate the model instances in the database using the min
   * aggregation function and model attribute.
   *
   * @param map A lambda function that will take the queryable model properties
   *            and produce the attribute to aggregate by.
   * @returns A promise that resolves with the aggregation value if successful.
   */
  public async min(map: (attrs: ModelQueryables<T>) => Queryable<any>,
                   options?: AggregateOptions): Promise<any> {
    return Promise.resolve(this.aggregate('min', map, options));
  }

  /**
   * Aggregate the model instances in the database using the max
   * aggregation function and model attribute.
   *
   * @param map A lambda function that will take the queryable model properties
   *            and produce the attribute to aggregate by.
   * @returns A promise that resolves with the aggregation value if successful.
   */
  public async max(map: (attrs: ModelQueryables<T>) => Queryable<any>,
                   options?: AggregateOptions): Promise<any> {
    return Promise.resolve(this.aggregate('max', map, options));
  }

  /**
   * Aggregate the model instances in the database using the sum
   * aggregation function and model attribute.
   *
   * @param map A lambda function that will take the queryable model properties
   *            and produce the attribute to aggregate by.
   * @returns A promise that resolves with the aggregation value if successful.
   */
  public async sum(map: (attrs: ModelQueryables<T>) => Queryable<any>,
                   options?: AggregateOptions): Promise<any> {
    return Promise.resolve(this.aggregate('sum', map, options));
  }

  /**
   * Find or create a model instance in the database using the built query.
   * The created instance will use any values set in the query,
   * hence you will need to build the query using the eq attribute
   * method so that the instance is built with the right attribute values.
   *
   * This *will not* update any associations.
   *
   * @param defaults The default values to be used alongside the search parameters
   *                 when the instance is being created.
   * @param options Any extra Sequelize find or initialize options required.
   * @returns A promise that resolves with the found/created instance and
   *          a bool that is true when an instance was created.
   */
  public async findOrCreate(defaults?: Partial<T>, options?: FindOrInitializeOptions<T>): Promise<[T, boolean]> {
    let model = this.model;
    let [data, created] = await Promise.resolve(
      this.internalModel
        .findOrCreate({
          ... options,

          defaults: defaults as T,
          where: this.compileWheres(),
        })
        .catch(SequelizeValidationError, async (err: SequelizeValidationError) => {
          return Promise.reject(coerceValidationError(model, err));
        })
    );

    // Turn the Sequelize data into a ModelSafe model class
    return [
      // FIXME: The any cast is required here to turn the plain T into a Sequelize instance T
      await model.deserialize((data as any as Instance<T>).toJSON(), { validate: false }) as T,
      created
    ];
  }

  /**
   * Prepare an instance to be stored in the database.
   * This serialises the ModelSafe instance to a plain JS
   * object and then also adds on any foreign keys, if found.
   *
   * If the `associations` parameter is set to `true`, then this
   * also serializes associations to JS.
   *
   * @param instance The instance to prepare to be stored.
   * @param associations Whether to add associations to the object result too.
   * @returns A promise that resolves with the instance in plain object form.
   */
  protected async prepare(instance: T, associations: boolean = false): Promise<object> {
    let includes = this.options.includes || [];
    let data = await this.model.serialize(instance, { associations });

    // No point doing anything extra if no includes were set.
    if (includes.length < 1) {
      return data;
    }

    // Add all foreign keys to the data, if it's an early association (belongs-to).
    for (let include of includes) {
      let key = include.as;
      let internalAssoc = this.internalModel.associations[key];
      let value = instance[key];

      if (_.isNil(value)) {
        continue;
      }

      // Add any foreign keys that are set outside of association values
      if (internalAssoc.associationType === 'BelongsTo') {
        let identifier = (internalAssoc as BelongsToAssociation).identifier;
        let targetIdentifier = (internalAssoc as BelongsToAssociation).targetIdentifier;
        let id;

        // If they've provided an association value, then pull the id off that.
        if (value) {
          id = value[targetIdentifier];
        }

        // If there's still no ID, try getting it of a foreign key value
        if (!id) {
          id = instance[identifier];
        }

        if (id) {
          data[identifier] = id;
        }
      }
    }

    return data;
  }

  /**
   * Saves any associations that have been included
   * onto a Sequelize internal model instance, and then
   * reloads that internal modal data.
   *
   * @param internalInstance The internal Sequelize model instance.
   * @param data The data that the model originally had in its ModelSafe instance form
   *             This is used to get the original values of the model instance and its associations.
   * @param transaction An optional transaction to use with associate calls.
   * @returns A promise that resolves with an associated & reloaded instance, or rejects
   *          if there was an error.
   */
  protected async associate(internalInstance: Instance<T>, data: Partial<T>, transaction?: Transaction): Promise<Instance<T>> {
    let assocs = getModelAssociations(this.model);
    let includes = this.options.includes || [];

    // No point doing any operations/reloading if
    // no includes were set.
    if (includes.length < 1) {
      return internalInstance;
    }

    for (let include of includes) {
      let key = include.as;
      let value = (data as object)[key];
      let internalAssoc = this.internalModel.associations[key];
      let assoc = assocs[key];
      let assocTarget = assoc.target;

      if (isLazyLoad(assocTarget)) {
        assocTarget = (assocTarget as () => ModelConstructor<any>)();
      }

      // We need the internal and ModelSafe association in order to see how to save the value.
      // We also ignore undefined values since that means they haven't been
      // loaded/shouldn't be touched.
      if (!internalAssoc || !assocTarget || typeof (value) === 'undefined') {
        continue;
      }

      let internalAssocModel = this.db.getInternalModel(assocTarget as ModelConstructor<any>);
      let internalAssocPrimary = this.db.getInternalModelPrimary(assocTarget as ModelConstructor<any>).compileLeft();

      // Don't attempt to do anything else if the association's
      // foreign value was set - it would have already been associated
      // during the update or create call.
      if (internalAssoc.associationType === 'BelongsTo' &&
          internalInstance.get((internalAssoc as BelongsToAssociation).identifier)) {
        continue;
      }

      // This is the same across all associations.
      let method = internalInstance['set' + Utils.uppercaseFirst(key)];

      if (typeof (method) !== 'function') {
        continue;
      }

      method = method.bind(internalInstance);

      if (_.isNil(value)) {
        // The value is null like (but not undefined, as that was ignored earlier).
        // Clear any existing association value and continue.
        await Promise.resolve(method(null, { transaction }));

        continue;
      }

      let coerced: Instance<any> | Instance<any>[];

      // The value is either a serialized JS plain object, or an array of them.
      // Build them into Sequelize instances then save the association if required.
      let coerceSave = async (values: object): Promise<Instance<any>> => {
        let coerced = await coerceInstance(internalAssocModel, values);
        let keys = Object.keys(values);

        // If we have any keys other than the association's primary key,
        // then save the instance. The logic being that if it's
        // just an ID then the user is only trying to update the association
        // and doesn't care if the association instance is updated.
        if (keys.filter(key => key !== internalAssocPrimary).length > 0) {
          return coerced.save({ transaction });
        }

        return coerced;
      };

      if (_.isArray(value)) {
        coerced = await Promise.all(_.map(value, async (item: object) => coerceSave(item)));
      } else {
        coerced = await coerceSave(value);
      }

      // Now set the association
      // TODO: Only set associations if they've changed.
      await Promise.resolve(method(coerced, { transaction }));
    }

    return await Promise.resolve(internalInstance.reload({
      include: this.compileIncludes(),
      transaction
    })) as Instance<any>;
  }

  /**
   * Automatically update or create a model instance
   * depending on whether it has already been created.
   *
   * This is done by inspecting the primary key and seeing
   * if it's set. If it's set, a where query with
   * that ID is added and then update is called.
   * If no primary key was set, the model instance is created then returned.
   *
   * By default ModelSafe validations will be run.
   *
   * @param instance The model instance.
   * @param options The create or update options. The relevant will be used depending
   *                on the value of the primary key.
   * @returns A promise that resolves with the saved instance if successful.
   */
  public async save(instance: T, options?: CreateOptions | UpdateOptions): Promise<T> {
    options = {
      validate: true,

      ... options
    };

    // If the value is provided looks like a T instance but isn't actually,
    // coerce it.
    if (_.isPlainObject(instance)) {
      instance = await this.model.deserialize(instance, { validate: false }) as T;
    }

    let primary = this.db.getInternalModelPrimary(this.model);
    let primaryValue = instance[primary.compileLeft()];

    // If the primary key is set, update.
    // Otherwise create.
    if (primaryValue) {
      if (options.validate) {
        // We validate here. The update call only validates non-required validations,
        // whereas we want to do required validations too since we know that the instance
        // should be a full valid instance (whereas what is passed into update may be a partial,
        // hence why not every field should be required)
        await instance.validate();
      }

      let [num, instances] = await this
        .where(_m => primary.eq(primaryValue))
        .update(await instance.serialize(), options as UpdateOptions);

      // Handle this just in case.
      // Kind of unexpected behaviour, so we just return null.
      if (num < 1 || instances.length < 1) {
        return null;
      }

      return instances[0];
    } else {
      // Create will perform validations for us as well
      return this.create(instance, options as CreateOptions);
    }
  }

  /**
   * Creates a model instance in the database.
   *
   * By default ModelSafe validations will be run and
   * associations will be updated if they have been included before hand.
   *
   * @rejects ValidationError
   * @param instance The model instance to create.
   * @param option Any extra Sequelize create options required.
   * @returns A promise that resolves with the created instance if successful.
   */
  public async create(instance: T, options?: CreateOptions): Promise<T> {
    options = {
      associate: true,
      validate: true,

      ... options
    };

    // If the value is provided looks like a T instance but isn't actually,
    // coerce it.
    if (_.isPlainObject(instance)) {
      instance = await this.model.deserialize(instance, { validate: false }) as T;
    }

    // Validate the instance if required
    if (options.validate) {
      await instance.validate();
    }

    let model = this.model;
    let values = await this.prepare(instance, true);
    let data = await Promise.resolve(
      this.internalModel
        .create(values as T, options)
        .catch(SequelizeValidationError, async (err: SequelizeValidationError) => {
          return Promise.reject(coerceValidationError(model, err));
        })
    );

    if (options.associate) {
      // Save associations of the Sequelize data and reload
      data = await this.associate((data as any as Instance<T>), values, options ? options.transaction : null) as any as T;
    }

    // Turn the Sequelize data into a ModelSafe class instance
    return await model.deserialize((data as any as Instance<T>).toJSON(), { validate: false }) as T;
  }

  /**
   * Creates multiple instances in the database.
   * Note, that like Sequelize, there's no guaranteed that
   * the returned values here are the exact values that have been created.
   * If you want those values, you should re-query the database
   * once the bulk create has succeeded.
   *
   * By default ModelSafe validations will be run.
   * This *will not* update any associations, unless those associations
   * are set by a foreign key (ie. belongs-to).
   *
   * @rejects ValidationError
   * @param instances The array of model instances to create.
   * @param options Any extra Sequelize bulk create options required.
   * @returns The array of instances created. See above.
   */
  public async bulkCreate(instances: T[], options?: BulkCreateOptions): Promise<T[]> {
    options = {
      validate: true,

      ... options
    };

    let model = this.model;

    // If any is provided looks like a T instance but isn't actually,
    // coerce it.
    instances = await Promise.all(instances.map(async (instance: T) => {
      if (_.isPlainObject(instance)) {
        return await model.deserialize(instance, { validate: false }) as T;
      }

      return instance;
    }));

    // Validate all instances if required
    if (options.validate) {
      for (let instance of instances) {
        await instance.validate();
      }
    }

    let data = await Promise.resolve(
      this.internalModel
        .bulkCreate(
          await Promise.all(_.map(instances, async (instance) => await this.prepare(instance))) as T[],
          options
        )
        .catch(SequelizeValidationError, async (err: SequelizeValidationError) => {
          return Promise.reject(coerceValidationError(model, err));
        })
    );

    // Deserialize all returned Sequelize models
    return Promise.all<T>(data.map(async (item: T): Promise<T> => {
      // FIXME: The any cast is required here to turn the plain T into a Sequelize instance T
      return await model.deserialize((item as any as Instance<T>).toJSON(), { validate: false }) as T;
    }));
  }

  /**
   * Update one or more instances in the database with the partial
   * property values provided.
   *
   * By default ModelSafe validations will be run (on the properties provided, only) and
   * associations will be updated if they have been included before hand.
   *
   * @rejects ValidationError
   * @param values The instance data to update with.
   * @param options Any extra Sequelize update options required.
   * @return A promise that resolves to a tuple with the number of instances updated and
   *         an array of the instances updated, if successful.
   */
  public async update(values: Partial<T>, options?: UpdateOptions): Promise<[number, T[]]> {
    options = {
      associate: true,
      validate: true,

      ... options
    };

    let model = this.model;

    // Validate the values partial if required
    if (options.validate) {
      // Ignore required validation since values is a partial
      await (await model.deserialize(values, {
        validate: false,
        associations: false
      })).validate({ required: false });
    }

    let [num, data] = await Promise.resolve(
      this.internalModel
        .update(values as T, {
          ... options,

          where: this.compileWheres(),
          limit: this.options.taken > 0 ? this.options.taken : undefined,
        })
        .catch(SequelizeValidationError, async (err: SequelizeValidationError) => {
          return Promise.reject(coerceValidationError(model, err));
        })
    );

    // FIXME: The update return value is only supported in Postgres,
    // so we findAll here to emulate this on other databases.
    // Could be detrimental to performance.
    data = await Promise.resolve(this.internalModel.findAll({
      where: this.compileWheres(),
      limit: this.options.taken > 0 ? this.options.taken : undefined,
    }));

    if (options.associate) {
      // Save associations of each Sequelize data and reload all
      data = await Promise.all(data.map(async (item: T) => {
        return await this.associate((item as any as Instance<T>), values, options ? options.transaction : null) as any as T;
      }));
    }

    // Deserialize all returned Sequelize models
    return [
      num,

      await Promise.all<T>(data.map(async (item: T): Promise<T> => {
        // FIXME: The any cast is required here to turn the plain T into a Sequelize instance T
        return await model.deserialize((item as any as Instance<T>).toJSON(), { validate: false }) as T;
      }))
    ];
  }

  /**
   * Update or insert a model using the provided model as a query.
   * This will update an instance from the provided partial, or insert/create one
   * if none exists matching the provided model instance.
   * The model provided will be used as a partial, which will mean that all
   * attributes are optional and non-defined ones will be excluded from
   * the query/insertion.
   *
   * ModelSafe validations will run by default,
   * but this *will not* update any associations.
   *
   * @param values The property values to upsert using.
   * @param options Any extra Sequelize upsert options required.
   * @returns A promise that will upsert and contain true if an instance was inserted.
   */
  public async upsert(values: Partial<T>, options?: UpsertOptions): Promise<boolean> {
    options = {
      validate: true,

      ... options
    };

    let model = this.model;

    // Validate the values partial if required
    if (options.validate) {
      // Ignore required validation since values is a partial
      await (await model.deserialize(values, {
        validate: false,
        associations: false
      })).validate({ required: false });
    }

    return Promise.resolve(
      this.internalModel
        .upsert(values as T, {
          ... options,

          includes: this.compileIncludes()
        })
        .catch(SequelizeValidationError, async (err: SequelizeValidationError) => {
          return Promise.reject(coerceValidationError(model, err));
        })
    );
  }

  /**
   * Compile the find options for a find/findOne call, as expected by Sequelize.
   *
   * @returns The Sequelize representation.
   */
  public compileFindOptions(): FindOptions {
    let options: FindOptions = {
      where: this.compileWheres(),
    };

    if (this.options.attrs) {
      options.attributes = this.compileAttributes();
    }

    if (this.options.includes) {
      options.include = this.compileIncludes();
    }

    if (this.options.orderings) {
      options.order = this.compileOrderings();
    }

    if (this.options.skipped > 0) {
      options.offset = this.options.skipped;
    }

    if (this.options.taken > 0) {
      options.limit = this.options.taken;
    }

    return options;
  }

  /**
   * Compile the where query to a representation expected by Sequelize.
   *
   * @returns The Sequelize representation.
   */
  public compileWheres(): WhereOptions {
    return _.extend.apply(_, [{}].concat(this.options.wheres.map(w => w.compile())));
  }

  /**
   * Compile the attributes to a representation expected by Sequelize.
   *
   * @returns The Sequelize representation.
   */
  public compileAttributes(): FindOptionsAttributesArray {
    return this.options.attrs.map(w => w.compileRight());
  }

  /**
   * Compile the orderings to a representation expected by Sequelize.
   *
   * @returns The Sequelize representation.
   */
  public compileOrderings(): any {
    return this.options.orderings.map(([attr, order]) => [attr.compileLeft(), order.toString()]);
  }

  /**
   * Compile the includes to a representation expected by Sequelize, including nested includes
   *
   * @returns The Sequelize representation.
   */
  public compileIncludes(): any {
    return this.options.includes || [];
  }
}
