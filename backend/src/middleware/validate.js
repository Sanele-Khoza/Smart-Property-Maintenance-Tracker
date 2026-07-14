import AppError from '../shared/errors/AppError.js';

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      const err = new AppError('Validation error', 422, 'VALIDATION_ERROR');
      err.errors = errors;
      return next(err);
    }
    req.validatedBody = result.data;
    next();
  };
}

export default validate;
