# 0.6.1

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
