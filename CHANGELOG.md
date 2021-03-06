# 2.0.8

* [UPDATE] allow for untyped ordering query for nested associations. Will add typing in the next patch

* Previous versions were skipped due to accidental publishing

# 2.0.4

* [UPDATE] allow for database raw query

# 2.0.3

* [FIX] compile cols with `compileRight()` in group bys and fns

# 2.0.2

* [UPDATE] return more specific types from queryables 

# 2.0.1

* [UPDATE] add groupBy 

# 2.0.0

* [UPDATE] update to modelsafe 2

# 1.0.0-alpha.36

* [FIX] account for includes in `count()`

# 1.0.0-alpha.35

* [FIX] stop `compileWheres()` from breaking dates

# 1.0.0-alpha.34

* [FIX] don't put all attribute errors into the `$constraint` group

# 1.0.0-alpha.33

* [FIX] when merging queries, don't set existing query onto new one by default. leads to duplicate rules

# 1.0.0-alpha.32

* [FIX] when merging queries, don't assume option params are always set

# 1.0.0-alpha.31

* [FEATURE] coerce constraint validations also (put into errors.$constraints)

# 1.0.0-alpha.30

* [FIX] remove typedoc due to security issue

# 1.0.0-alpha.29

* [FIX] don't `associate()` if no includes are pass at all

# 1.0.0-alpha.28

* [FIX] make the validator happier when associating in create()

# 1.0.0-alpha.27

* [FIX] pick() exact include sub-query attrs to avoid a sequelize bug

# 1.0.0-alpha.26

* [FIX] use nodejs version of cloner

# 1.0.0-alpha.25

* [FIX] import cloner file into repo, since it's causing a package issue i don't want to work out"

# 1.0.0-alpha.24

* [FIX] switch an extend to use new cloner

# 1.0.0-alpha.23

* [FIX] use a cloner that can handle symbol keys when merging wheres

# 1.0.0-alpha.22

* [FIX] set `as` in `getAssociation` so all assocs get it

# 1.0.0-alpha.21

* [FIX] allow target assoc to be set on an assoc for cases where the target name is different to the default

# 1.0.0-alpha.19

* [FIX] compile attributes so they aren't ambiguous

# 1.0.0-alpha.18

* [FIX] merge duplicate includes properly
* [FIX] explicitly save new assocs regardless of associatedOnly option

# 1.0.0-alpha.17

* [FIX] calculate include depth and use for de/serialisation, to prevent circ deps from causing issues
* [CHANGE] set associateOnly to true by default as this is the expected behaviour

# 1.0.0-alpha.16

* [CHANGE] upgrade sequelize and fix new typing issues

# 1.0.0-alpha.15

* [FEATURE] add `Query.merge` to allow two queries to be merged
* [FEATURE] store rich includes to allow for recursively mergable includes
* [FEATURE] add `associateOnly` as include option that doesn't save the data on included associations, just sets the association
* [FIX] use transaction in all sequelize calls in `update()`
* [FIX] coerce `associate` save errors into a `ValidationError` and prefix the property keys with the assoc key

# 1.0.0-alpha.14

* [FIX] when associating belongs-tos in update, check original data for direct id attr, not data from db

# 1.0.0-alpha.13

* [FIX] map sequelize errors into new modelsafe validation error format

# 1.0.0-alpha.12

* [FIX] account for target model when determining duplicate foreign keys

# 1.0.0-alpha.11

* [FIX] pass a default foreign key to sequelize for has-one associations. otherwise it does the wrong thing
* [FIX] reject models that have duplicate has-one foreign keys
* [FEATURE] tests

# 1.0.0-alpha.10

* [FIX] when de/serialising instances, use an infinite depth (or near enough) so associations aren't wiped

# 1.0.0-alpha.9

* [CHANGE] Add custom `ThroughOptions` to support defining a through as non-unique

# 1.0.0-alpha.8

* [FIX] Resolve coerced Sequelizes instances not being saveable without a primary key

# 1.0.0-alpha.7

* [FIX] allow validation to succeed if all errors are filtered out for required default value attrs

# 1.0.0-alpha.6

* [FIX] Resolve bug with default-value require validation exclusion

# 1.0.0-alpha.5

* [FIX] Resolve bug with auto-increment require validation exclusion

# 1.0.0-alpha.4

* [CHANGE] Upgrade to TypeScript 2.3
* [CHANGE] Require ModelSafe 1.0.0-alpha.8
* [FIX] ModelSafe required attribute validations are now correctly ignored for auto-ncrement fields

# 1.0.0-alpha.3

* [FIX] `findOne` and `findById` should only deserialize if they succeeded, to prevent a null dereference

# 1.0.0-alpha.2

* [FIX] 'through' models should be lazy to avoid null-class references

# 1.0.0-alpha.1

* [CHANGE] Moved to ModelSafe alpha 1.0.0-alpha.1
* [CHANGE] Sequelize models are now correctly serialized to regular ModelSafe model class instances.
  The ModelSafe models were originally only being used as types and not as proper classes,
  which means that helper methods and getters/setters defined were not available.
  This is quite a big change and may break existing code.
* [CHANGE] The `drop` method of queries has been renamed to `skip` in order
  to avoid confusion with the database `drop` term (for destroying a database table/schema)
* [CHANGE] The truncate method of query can now take optional Sequelize truncate options
* [CHANGE] `through` for belongs to many is no longer auto-generated and must be manually defined
* [FEATURE] Allow for providing a ModelSafe model as `through` for belongs to many, allowing
  for more complicated join/through models
* [FEATURE] There is now a new `drop` command on queries for dropping database tables

# 0.9.0

* Added `transaction` param to `associate()` to allow association calls to be transacted
* Transacted `associate` and `reload` calls in `create()` and `update()`

# 0.8.1

* Added includeAll() for including all associations on a query
* Fixed an include bug that caused shadowing of assoc ids and thus notNull validation errors
* Lost a minor version along the way somewhere

# 0.7.0

* Bump to ModelSafe `0.7.1`
* Improve the error stack generated by coerced validation errors to allow for easier debugging
  of Sequelize validation errors

# 0.6.2

* Treat plain attributes passed to `order` as a path, and map the path into a
  fully-disambiguous model path. Prevents disambiguous attr names, and allows ordering
  on child attrs
* Add `plain` for creating `PlainAttribute`s easily

# 0.6.1

* Fix include options broken compilation to Sequelize include options

# 0.6.0

* Fix casing of default `through` setting
* Support providing include options in `include` for setting things like `required` off
  or manually overriding the `as` of a eager-load

# 0.5.2

* Fix association saving to support setting associations with an include flag
  even if the association target hasn't come directly from the database (i.e.
  it's a plain JS object instead of a Sequelize instance)

# 0.5.1

* Bump to ModelSafe 0.5.2 for `ValidationError` fixes

# 0.5.0

* Add `findById` operation

# 0.4.0

* Support ModelSafe's new lazy loading association declaration feature
* Add `save` operation to querying that either updates or creates a model instance
  automatically based off the primary key of the model

# 0.3.1

* Re-add `getModelPrimary` as `getInternalModePrimary` to the database class

# 0.3.0

* Migrate to using ModelSafe for model definitions
* Simplify existing code / improve code quality
