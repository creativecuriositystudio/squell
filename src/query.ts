/** Contains the type-safe querying interface that wraps Sequelize queries. */
import * as _ from 'lodash';
import * as sequelize from 'sequelize';
import { Model, ModelConstructor, ModelErrors, ValidationError,
         getAttributes as getModelAttributes,
         getAssociations as getModelAssociations } from 'modelsafe';
import { FindOptions, WhereOptions, FindOptionsAttributesArray,
         DestroyOptions, TruncateOptions, RestoreOptions,
         CountOptions, AggregateOptions, CreateOptions, UpdateOptions,
         BulkCreateOptions, UpsertOptions, FindOrInitializeOptions,
         IncludeOptions, Utils, ValidationError as SequelizeValidationError,
         Model as SequelizeModel
       } from 'sequelize';

import { Attribute, PlainAttribute, AssocAttribute, ModelAttributes } from './attribute';
import { getAssociationOptions } from './metadata';
import { Where } from './where';
import { Database } from './database';

/** A type alias for a sorting order. */
export type Order = string;

/** Represents descending order. */
export const DESC: Order = 'DESC';

/** Represents ascending order. */
export const ASC: Order  = 'ASC';

/** Represents the ordering of an attribute. */
export type AttributeOrder<T> = [Attribute<T>, Order];

/**
 * Query options for a Squell query.
 */
export interface QueryOptions {
  /** The array of where queries for the query. */
  wheres: Where[];

  /** The array of attribute filters for the query. */
  attrs: Attribute<any>[];

  /** The array of association filters for the query. */
  includes: IncludeOptions[];

  /** The array of attribute orderings for the query. */
  orderings: AttributeOrder<any>[];

  /** The number of records to drop (i.e. OFFSET). */
  dropped: number;

  /** The number of records to take (i.e. LIMIT). */
  taken: number;
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

  return new ValidationError<T>(ctor, err.message, errors as ModelErrors<T>);
}

/**
 * Get the attributes of a model as a mapped type.
 *
 * @param ctor The model constructor.
 * @returns The mapped attributes type.hi
 */
function getAttributes<T extends Model>(ctor: ModelConstructor<T>): ModelAttributes<T> {
  let result = {};
  let attrs = getModelAttributes(ctor);
  let assocs = getModelAssociations(ctor);

  for (let key of Object.keys(attrs)) {
    result[key] = new PlainAttribute(key);
  }

  for (let key of Object.keys(assocs)) {
    result[key] = new AssocAttribute(key);
  }

  return result as ModelAttributes<T>;
}

/**
 * Check if an any value is a Sequelize instance.
 *
 * @param value The value to check.
 * @returns Whether the value is a Sequelize instance.
 */
function isSequelizeInstance(value: any): boolean {
  return typeof (value) === 'object' && value && typeof (value.toJSON) === 'function';
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
   * @param internalModel The internal Sequelize representation of the model.
   * @param wheres The array of where queries.
   * @param attrs The array of attribute filters.
   * @param orderings The array of attribute orderings.
   * @param dropped The number of records to be dropped.
   * @param taken The number of records to be taken.
   */
  constructor(db: Database, model: ModelConstructor<T>, options?: QueryOptions) {
    this.db = db;
    this.model = model;
    this.internalModel = db.getInternalModel<T>(model);
    this.options = {
      wheres: [],
      dropped: 0,
      taken: 0,

      ... options
    };
  }

  /**
   * Filter a query using a where query.
   *
   * @param map A function that will take the queried model attributes
   *            and produce the where query to filter
   * @returns   The filtered query.
   */
  public where(map: (attrs: ModelAttributes<T>) => Where): Query<T> {
    let options = { ... this.options, wheres: this.options.wheres.concat(map(getAttributes(this.model))) };

    return new Query<T>(this.db, this.model, options);
  }

  /**
   * Select the attributes to be included in a query result.
   *
   * @params map A function that will take the queried model attributes
   *             and produce an array of attributes to be included.
   * @returns The new query with the selected attributes only.
   */
  public attributes(map: (attrs: ModelAttributes<T>) => Attribute<any>[]): Query<T> {
    let attrs = this.options.attrs || [];
    let options = { ... this.options, attrs: attrs.concat(map(getAttributes(this.model))) };

    return new Query<T>(this.db, this.model, options);
  }

  /**
   * Eager load an association model with the query.
   * An optional function can be provided to change the query on the association
   * model in order to do things like where queries on association query.
   *
   * @param map A function that will take the queried model attributes
   *            and produce the attribute the association is under.
   * @param query A function that will take the default query on the association model
   *              and return a custom one, i.e. allows for adding where queries
   *              to the association query.
   * @returns The eagerly-loaded query.
   */
  public include<U extends Model>(model: ModelConstructor<U>,
                                  attr: (attrs: ModelAttributes<T>) => Attribute<any>,
                                  query?: (query: Query<U>) => Query<U>): Query<T> {
    let includes = this.options.includes || [];
    let key = attr(getAttributes(this.model)).compileLeft();
    let assocOptions = getAssociationOptions(this.model, key);
    let includeOptions = {
      model: this.db.getInternalModel(model),
      as: assocOptions && assocOptions.as ? assocOptions.as : key
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

    let options = { ... this.options, includes: includes.concat([includeOptions]) };

    return new Query<T>(this.db, this.model, options);
  }

  /**
   * Order the future results of a query.
   *
   * @params map A function that will take the queried model attributes
   *             and produce an array of attribute orders for the result to be ordered by.
   * @returns    The ordered query.
   */
  public order(map: (attrs: ModelAttributes<T>) => AttributeOrder<any>[]): Query<T> {
    let orderings = this.options.orderings || [];
    let options = { ... this.options, orderings: orderings.concat(map(getAttributes(this.model))) };

    return new Query<T>(this.db, this.model, options);
  }

  /**
   * Drop a number of future results from the query.
   * This essentially increases the OFFSET amount,
   * and will only affect the find and findOne queries.
   */
  public drop(num: number): Query<T> {
    let options = { ... this.options, dropped: this.options.dropped + num };

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
    return Promise.resolve(this.internalModel.findAll({ ... options, ... this.compileFindOptions() }));
  }

  /**
   * Find a single model instance using the built query.
   *
   * @param options Any extra Sequelize find options required.
   * @returns A promise that resolves to the found instance if successful.
   */
  public async findOne(options?: FindOptions): Promise<T> {
    return Promise.resolve(this.internalModel.findOne({ ... options, ... this.compileFindOptions() }));
  }

  /**
   * Find a single model instance by a primary key/ID.
   *
   * @param id The primary key/ID value.
   * @param options Any extra Sequelize find options required.
   * @returns A promise that resolves to the found instance if successful.
   */
  public async findById(id: any, options?: FindOptions): Promise<T> {
    return Promise.resolve(this.internalModel.findById(id, options));
  }

  /**
   * Truncate the model table in the database.
   *
   * @returns A promise that resolves when the model table has been truncated.
   */
  public async truncate(): Promise<void> {
    return Promise.resolve(this.internalModel.truncate());
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
   * aggregation function and model attribute.
   *
   * @param fn The aggregate function to use.
   * @param map A lambda function that will take the queried model attributes
   *            and produce the attribute to aggregate by.
   * @returns A promise that resolves with the aggregation value if successful.
   */
  public async aggregate(fn: string, map: (attrs: ModelAttributes<T>) => Attribute<any>,
                         options?: AggregateOptions): Promise<any> {
    return Promise.resolve(this.internalModel.aggregate(map(getAttributes(this.model)).compileLeft(), fn, {
      ... options,

      where: this.compileWheres(),
      limit: this.options.taken > 0 ? this.options.taken : undefined,
    }));
  }

  /**
   * Aggregate the model instances in the database using the min
   * aggregation function and model attribute.
   *
   * @param map A lambda function that will take the queried model attributes
   *            and produce the attribute to aggregate by.
   * @returns A promise that resolves with the aggregation value if successful.
   */
  public async min(map: (attrs: ModelAttributes<T>) => Attribute<any>,
                   options?: AggregateOptions): Promise<any> {
    return Promise.resolve(this.aggregate('min', map, options));
  }

  /**
   * Aggregate the model instances in the database using the max
   * aggregation function and model attribute.
   *
   * @param map A lambda function that will take the queried model attributes
   *            and produce the attribute to aggregate by.
   * @returns A promise that resolves with the aggregation value if successful.
   */
  public async max(map: (attrs: ModelAttributes<T>) => Attribute<any>,
                   options?: AggregateOptions): Promise<any> {
    return Promise.resolve(this.aggregate('max', map, options));
  }

  /**
   * Aggregate the model instances in the database using the sum
   * aggregation function and model attribute.
   *
   * @param map A lambda function that will take the queried model attributes
   *            and produce the attribute to aggregate by.
   * @returns A promise that resolves with the aggregation value if successful.
   */
  public async sum(map: (attrs: ModelAttributes<T>) => Attribute<any>,
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
    let self = this;

    return Promise.resolve(
      this.internalModel
        .findOrCreate({
          ... options,

          defaults: defaults as T,
          where: this.compileWheres(),
        })
        .catch(SequelizeValidationError, async (err: SequelizeValidationError) => {
          return Promise.reject(coerceValidationError(self.model, err));
        })
    );
  }

  /**
   * Returns a plain object version of the instance with attributes only.
   *
   * @param instance The model instance to strip.
   * @returns The stripped model instance.
   */
  private prepareAttributes(instance: T): T {
    return _.pick(instance, Object.keys(getModelAttributes(this.model))) as T;
  }

  /**
   * Returns a plain object version of the instance with associations only.
   *
   * @param instance The model instance to strip.
   * @returns The stripped model instance.
   */
  private prepareAssociations(instance: T): T {
    return _.pick(instance, Object.keys(getModelAssociations(this.model))) as T;
  }

  /**
   * A helper function that inspects any association
   * values on a model instance and updates them if
   * required.
   *
   * @param model The model instance to associate.
   * @param assocValues The associations of the instance, as a plain object.
   * @returns A promise that associates the instance and returns a reloaded instance afterwards.
   */
  private async associate(instance: T, assocValues: {}): Promise<T> {
    let values = instance as {};
    let assocs = getModelAssociations(this.model);
    let includes = this.options.includes || [];

    // No point doing any operations/reloading if
    // no includes were set.
    if (includes.length < 1) {
      return instance;
    }

    for (let include of includes) {
      let key = include.as;
      let target = assocValues[key];

      // This is the same across all associations.
      let method = values['set' + Utils.uppercaseFirst(key)];

      if (typeof (method) !== 'function') {
        continue;
      }

      method = method.bind(instance);

      if (!target) {
        await method(undefined);

        continue;
      }

      // FIXME: Any is required here..
      let coerce = (target: any) => {
        if (isSequelizeInstance(target)) {
          return target;
        }

        // Just a plain instance without the Sequelize sugar.
        // We need to build it into a Sequelize model
        // in order for setting the association to work.
        return include.model.build(_.toPlainObject(target));
      };

      if (Array.isArray(target)) {
        target = target.map(t => coerce(t));
      } else {
        target = coerce(target);
      }

      // TODO: Only change associations if they've changed.
      await method(target);
    }

    // We have to reload the instance here to get any changed data.
    // FIXME: `reload` is provided by Sequelize but isn't wrapped in Squell yet so we cast any.
    return Promise.resolve((instance as any).reload({ include: this.compileIncludes() }));
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
   * @param instance The model instance.
   * @param options The create or update options. The relevant will be used depending
   *                on the value of the primary key.
   * @returns A promise that resolves with the saved instance if successful.
   */
  public async save(instance: T, options?: CreateOptions | UpdateOptions): Promise<T> {
    let primary = this.db.getInternalModelPrimary(this.model);
    let primaryValue = instance[primary.compileLeft()];

    // If the primary key is set, update.
    // Otherwise create.
    if (primaryValue) {
      let [num, instances] = await this
        .where(m => primary.eq(primaryValue))
        .update(instance, <UpdateOptions> options);

      // Handle this just in case.
      // Kind of unexpected behaviour, so we just return null.
      if (num < 1 || instances.length < 1) {
        return null;
      }

      return instances[0];
    } else {
      return this.create(instance, <CreateOptions> options);
    }
  }

  /**
   * Creates a model instance in the database.
   *
   * By default validations will be run.
   * Associations will be updated if they have been included before hand.
   *
   * @rejects ValidationError
   * @param instance The model instance to create.
   * @param option Any extra Sequelize create options required.
   * @returns A promise that resolves with the created instance if successful.
   */
  public async create(instance: T, options?: CreateOptions): Promise<T> {
    let self = this;
    let assocValues = this.prepareAssociations(instance);

    instance = await Promise.resolve(
      this.internalModel
        .create(this.prepareAttributes(instance), options)
        .catch(SequelizeValidationError, async (err: SequelizeValidationError) => {
          return Promise.reject(coerceValidationError(self.model, err));
        })
    );

    return this.associate(instance, assocValues);
  }

  /**
   * Creates multiple instances in the database.
   * Note, that like Sequelize, there's no guaranteed that
   * the returned values here are the exact values that have been created.
   * If you want those values, you should re-query the database
   * once the bulk create has succeeded.
   *
   * By default validations will not be run.
   * This *will not* update any associations.
   *
   * @rejects ValidationError
   * @param instances The array of model instances to create.
   * @param options Any extra Sequelize bulk create options required.
   * @returns The array of instances created. See above.
   */
  public async bulkCreate(instances: T[], options?: BulkCreateOptions): Promise<T[]> {
    let self = this;

    return Promise.resolve(
      this.internalModel
        .bulkCreate(_.map(instances, m => self.prepareAttributes(m)), options)
        .catch(SequelizeValidationError, async (err: SequelizeValidationError) => {
          return Promise.reject(coerceValidationError(self.model, err));
        })
    );
  }

  /**
   * Update an instance in the database using the query.
   * The model provided will be used as a mapped partial version, which
   * means that all of the model properties are optional - and
   * if there's not defined, they won't be updated.
   *
   * By default validations will be run.
   * Associations will be updated if they have been included before hand.
   * This can also update multiple instances.
   *
   * @rejects ValidationError
   * @param instance The model partial to update using.
   * @param options Any extra Sequelize update options required.
   * @return A promise that resolves to a tuple with the number of instances updated and
   *         an array of the instances updated, if successful.
   */
  public async update(instance: Partial<T>, options?: UpdateOptions): Promise<[number, T[]]> {
    let self = this;
    let assocValues = this.prepareAssociations(instance as T);
    let includes = this.options.includes || [];
    let promise = Promise.resolve(
      this.internalModel
        .update(this.prepareAttributes(instance as T), {
          ... options,

          where: this.compileWheres(),
          limit: this.options.taken > 0 ? this.options.taken : undefined,
        })
        .catch(SequelizeValidationError, async (err: SequelizeValidationError) => {
          return Promise.reject(coerceValidationError(self.model, err));
        })
    );

    let reloaded = [];
    let [num, instances] = await promise;

    // FIXME: The instance return value is only supported in Postgres,
    // so we findAll here to emulate this on other databases.
    // Could be detrimental to performance.
    instances = await Promise.resolve(this.internalModel.findAll({
      where: this.compileWheres(),
      limit: this.options.taken > 0 ? this.options.taken : undefined,
    }));

    for (let instance of instances) {
      reloaded.push(await this.associate(instance, assocValues));
    }

    return [num, reloaded];
  }

  /**
   * Update or insert a model using the provided model as a query.
   * This will update an instance from the provided partial, or insert/create one
   * if none exists matching the provided model instance.
   * The model provided will be used as a partial, which will mean that all
   * attributes are optional and non-defined ones will be excluded from
   * the query/insertion.
   *
   * This *will not* update any associations.
   *
   * @param instance The model partial to upsert using.
   * @param options Any extra Sequelize upsert options required.
   * @returns A promise that will upsert and contain true if an instance was inserted.
   */
  public async upsert(instance: Partial<T>, options?: UpsertOptions): Promise<boolean> {
    let self = this;

    return Promise.resolve(
      this.internalModel
        .upsert(instance as T, {
          ... options,

          includes: this.compileIncludes()
        })
        .catch(SequelizeValidationError, async (err: SequelizeValidationError) => {
          return Promise.reject(coerceValidationError(self.model, err));
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

    if (this.options.dropped > 0) {
      options.offset = this.options.dropped;
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
    return this.options.orderings.map(o => [o[0].compileRight(), o[1].toString()]);
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
