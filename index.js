'use strict';

const EventEmitter = require('events');

const _ = require('lodash');
const cardinal = require('cardinal');
const commander = require('commander');
fixCommander(commander);
let program = new commander.Command();
const prompt = require('inquirer');

const intRegex = /^-?[0-9]+$/;
const numberRegex = /^-?[0-9]+(\.[0-9]+)?$/;

const executionDoneEventEmitter = new EventEmitter();

/**
 * Interactive Command Line Interface
 * @type {Object}
 */
const icli = {

  /**
   * Colorize a portion of text
   * @type {Object}
   */
  format: {
    cmd:     msg => { return icli.format.custom(msg, '\x1b[33m'); }, // Yellow
    info:    msg => { return icli.format.custom(msg, '\x1b[36m'); }, // Cyan
    error:   msg => { return icli.format.custom(msg, '\x1b[31m'); }, // Red
    success: msg => { return icli.format.custom(msg, '\x1b[32m'); }, // Green
    custom: (msg, code) => { return code + msg + '\x1b[0m'; },
    // aliases
    ko: msg => { return icli.format.error(msg); },
    ok: msg => { return icli.format.success(msg); }
  },

  /**
   * highlight code with cardinal
   * @param  {strinf} input - the text to highlight
   * @param  {Object} options - cardinal options
   * @return {void}
   */
  highlight(input, options) {
    return cardinal.highlight(input, options);
  },

  /**
   * Commander instance getter
   * @returns {Object} - the commander instance
   */
  getProgram() {
    return program;
  },

  /**
   * Reinit Commander instance
   * @returns {void}
   */
  reset() {
    program = new commander.Command();
  },

  parse(argv) {
    return new Promise((resolve, reject) => {
      executionDoneEventEmitter.once('executed', (e, res) => {
        if (e !== null) {
          reject(e);
        } else {
          resolve(res);
        }
      });
      this.getProgram().parse(argv);
    });
  },

  /**
   * Create a new interactive command
   * @param {Object} config - a configuration object
   * @param {function} executeCommand - callback processing the property values once defined by the command line and the prompt
   * @returns {void}
   */
  createSubCommand(config, execute) {
    if (execute !== undefined) {
      config.execute = execute;
    }
    if (!_.isFunction(config.execute)) {
      throw new Error('A command configuration must have a function as "execute" property');
    }

    // Initialise config and resolve configuration aliases
    config.parameters = config.parameters || [];
    config.parameters.forEach(parameter => {
      if (parameter.type === 'int') {
        parameter.type = 'integer';
      }
      if (parameter.type === 'bool' || parameter.type === 'boolean') {
        parameter.type = 'confirm';
      }
    });

    // create the command
    const cmd = program.command(config.cmd, null, config.options);
    cmd.description(config.description);
    cmd._section = config.section;

    // Extract commander arguments and options from the list of parameters
    // Also enrich parameter configs with a name calculated from "cmdSpec"
    const tmp = parseParameters(config.parameters);
    const args = tmp.args;
    const options = tmp.options;

    // Add command arguments
    if (args.length) {
      cmd.arguments(args.join(' '));
    }
    // Add command options
    _.forEach(options, option => {
      cmd.option(
        option.flags,
        option.description,
        option.coercion
      );
    });

    cmd.action(getAction(
      config.parameters,
      config.execute,
      config.commanderActionHook,
      config.inquirerPromptHook,
      config.throwErrors,
      executionDoneEventEmitter
    ));

    return this;
  },

  /**
   * Generate a function that check if an item belongs to a list
   * @param {Array} list - the list of available values
   * @param {string} label - a label to identify the type of the list items (used in error messages)
   * @returns {function} - a validation function
   */
  generateListValidation(list, label) {
    return function listValidation(providedValues) {
      if (!_.isArray(providedValues)) {
        // If the parameter is not a list of value, we create it
        providedValues = [providedValues];
      }

      // If the list parameter is a function, we execute it
      if (typeof list === 'function') {
        list = list();
      }

      // If the list parameter is not Promise, we convert it
      if (!(typeof list.then === 'function')) {
        list = Promise.resolve(list);
      }

      return list.then(values => {
        // Normalize the values if some items are objects { value, label }
        const availableValues = _.map(values, item => { return item.value || item; });

        const errorMessages = [];
        _.forEach(providedValues, providedValue => {
          if (_.indexOf(availableValues, providedValue) === -1) {
            let help = 'available value: ' + icli.format.info(availableValues[0]);
            if (availableValues.length > 1) {
              help = 'available values: ' + _.map(availableValues, icli.format.info).join(', ');
            }
            errorMessages.push(icli.format.ko(providedValue) + ' is not a valid ' + (label ? label : 'value') + ' - ' + help);
          }
        });
        if (errorMessages.length > 0) {
          return errorMessages;
        }
        return true;
      });
    };
  }
};

module.exports = icli;


/**
 * Calculate parameter names and add a "validate" property if needed
 * Return the list of commander arguments and the list of commander options
 * @param {Array} parameters - a list of parameter configurations
 * @returns {Object} - an object containing the list of arguments and the list of options
 */
function parseParameters(parameters) {
  const args = [];
  const options = [];

  // Extract options and arguments
  // Enrich parameter configs with a name calculated from "cmdSpec"
  // Create automatic validators
  _.forEach(parameters, parameter => {
    if (!parameter.cmdSpec) {
      parameter.name = parameter.question.name;
    } else if (_.startsWith(parameter.cmdSpec, '-')) {
      // Case the parameter is an option
      options.push(parseOptionSpec(parameter));
    } else {
      // case the parameter is an argument
      args.push(parseArgumentSpec(parameter));
    }

    // Automaticaly add validators
    // If the parameter configuration already has a validator, we do not override it
    if (!parameter.validate) {
      // We create validators for all "list" and "checkbox" parameters
      switch (parameter.type) {
        case 'list':
        case 'checkbox':
          // We automatically add a validator to list and checkbox parameters
          parameter.validate = icli.generateListValidation(parameter.choices, parameter.validationMsgLabel);
          break;
        case 'integer':
          parameter.validate = (v) => {
            if (intRegex.test(v)) {
              return true;
            }
            return icli.format.error(v) + ' is not a valid value for ' + icli.format.info(parameter.name) + ' (expecting an integer)';
          };
          break;
        case 'number':
          parameter.validate = (v) => {
            if (numberRegex.test(v)) {
              return true;
            }
            return icli.format.error(v) + ' is not a valid value for ' + icli.format.info(parameter.name) + ' (expecting a number)';
          };
          break;
      }
    }
  });

  return { args, options };
}

/**
 * Parse a parameter of type "option" to calculate the name and generate the commander option
 * @param {Object} parameter - a parameter definition that will be enriched with a correct name
 * @returns {Object} - the properties of the commander option
 */
function parseOptionSpec(parameter) {
  // @see https://github.com/tj/commander.js/blob/33751b444a578259a7e37a0971d757452de3f228/index.js#L44-L46
  const flags = parameter.cmdSpec.split(/[ ,|]+/);
  if (flags.length > 1 && !/^[[<]/.test(flags[1])) { flags.shift(); }
  parameter.name = _.camelCase(flags.shift());
  return {
    flags: parameter.cmdSpec,
    description: parameter.description,
    coercion: parameter.coercion || getCoercionForType(parameter.type)
  };
}

/**
 * Parse a parameter of type "argument" to calculate the name and generate the commander option
 * @param {Object} parameter - a parameter definition that will be enriched with a correct name
 * @returns {Object} - a commander argument
 */
function parseArgumentSpec(parameter) {
  parameter.name = _.camelCase(parameter.cmdSpec);
  return parameter.cmdSpec;
}

/**
 * Get default coercion for a parameter type
 * @param {string} type - a parameter type
 * @returns {function|null} - the coercion function to apply to the command line argument/option
 */
function getCoercionForType(type) {
  switch (type) {
    case 'integer':
      return v => {
        return intRegex.test(v) ? parseInt(v) : v;
      };
    case 'number':
      return v => {
        return numberRegex.test(v) ? parseFloat(v) : v;
      };
    case 'checkbox':
      return v => { return v === '' ? [] : _.map(v.split(','), _.trim); };
    default:
      return undefined;
  }
}

/**
 * Construct the action() function passed to commander
 * @param {Array} parameters - the list of parameters
 * @param {function} executeCommand - the function that perform the interactive command task with property values
 * @param {function} commanderActionHook - a hook fuction that allows to alter the result of the command arguments/options
 * @param {function} inquirerPromptHook - a hook fuction that allows to alter the result of the questions
 * @returns {function} - The function that must be passed to cmd.action()
 */
function getAction(parameters, executeCommand, commanderActionHook, inquirerPromptHook, throwErrors, eventEmitter) {
  return function action() {
    // Hook that allows to tranform the result of the commander parsing, before converting it into parameter values
    const args = commanderActionHook ? commanderActionHook.apply(this, arguments) : arguments;
    const validations = _.reduce(parameters, (result, parameter) => {
      if (parameter.validate) {
        result[parameter.name] = parameter.validate;
      }
      return result;
    }, {});

    return processCliArgs(args, validations, throwErrors)
    .then(commandParameterValues => {
      // If the cli arguments are correct, we can prepare the questions for the interactive prompt
      // Launch the interactive prompt
      return Promise.all([
        commandParameterValues,
        prompt.prompt(parametersToQuestions(parameters, commandParameterValues))
      ]);
    })
    .then(result => {
      const commandParameterValues = result[0];
      const answers = result[1];
      for (const parameterName in answers) {
        const parameter = parameters.find(p => { return p.name === parameterName; });
        if (parameter.type === 'integer') {
          answers[parameterName] = parseInt(answers[parameterName]);
        } else if (parameter.type === 'number') {
          answers[parameterName] = parseFloat(answers[parameterName]);
        }
      }
      // Hook that allows to tranform the result of the inquirer prompt, before converting it into parameter values
      if (inquirerPromptHook) {
        return inquirerPromptHook(answers, commandParameterValues);
      }
      return Promise.resolve([answers, commandParameterValues]);
    })
    .then(parameters => {
      // Once we have all parameter values from the command and from the questions, we can execute the command
      return Promise.resolve(executeCommand(_.merge(parameters[1], parameters[0])));
    })
    .then(res => {
      // If everything worked until here, we emit "failure"
      // so that the Promise returned by parse() is resolved
      eventEmitter.emit('executed', null, res);
    })
    .catch(e => {
      // If a Promise has be rejected, we emit "failure"
      // so that the Promise returned by parse() is rejected
      eventEmitter.emit('executed', e);
    });
  };
}

/**
 * Transform the parameters of commander action() callback into a list of parameter values
 * and apply validations
 * @param {Object} cliArgs - "arguments" object passed to the method action()
 * @param {Object} validators - map of parameterKey / validation function
 * @returns {Array} - a list of parameter values
 */
function processCliArgs(cliArgs, validations, throwErrors) {
  // Initialize an object that will contain the final parameters (cli + prompt)
  const parameters = cliArgsToParameters(cliArgs);
  validations = validations || [];
  // We verify that arguments provided in the command are correct
  // For example, check if a provided identifier does really exist
  return validateParameters(parameters, validations)
  .then(validationResult => {
    if (validationResult !== true) {
      if (throwErrors === true) {
        throw new Error(validationResult.join('\n    '));
      }
      /* eslint-disable-next-line no-console */ /* istanbul ignore next */
      console.log('\n  ' + icli.format.ko('Error') + ':\n\n    ' + validationResult.join('\n    ') + '\n');
      /* istanbul ignore next */
      process.exit(1);
    }
    return parameters;
  });
}

/**
 * Verify and transform cli args into parameters
 * @param {Object} cliArgs - arguments and options that have been passed to the cli
 * @returns {Object} - parameter values
 */
function cliArgsToParameters(cliArgs) {
  // Initialize an object that will contain the final parameters (cli + prompt)
  const parameters = {};

  const cliData = Array.prototype.pop.call(cliArgs);
  // Convert cli arguments to parameters
  _.forEach(cliData._args, (argsDefinition, i) => {
    parameters[_.camelCase(argsDefinition.name)] = cliArgs[i];
  });
  // Convert cli options to parameters
  _.forEach(cliData.options, option => {
    const key = _.camelCase(option.long);
    // Fix the problem that initialised values to a function for options with names like "alias" or "description"
    const value = cliData.hasOwnProperty(key) ? cliData[key] : undefined;
    parameters[key] = value;
  });
  return parameters;
}

/**
 * Validate a list of parameter values
 * Used to validate parameters passed to the command before preparing prompt questions
 * @param {Object} parameters - parameters that have been passed to the cli
 * @param {Object} validations - validation functions
 * @returns {Array|bool} - true if all validations passed, or else an array of error messages
 */
function validateParameters(parameters, validations) {
  let messages = [];
  const responsesPromises = _.map(parameters, (value, key) => {
    if (typeof value !== 'undefined' && validations[key]) {
      return Promise.resolve(validations[key](value, {}, parameters))
      .then(validation => {
        if (validation === false) {
          // Generic message
          messages.push(icli.format.error(parameters[key]) + ' is not a valid value for ' + icli.format.info(key));
        } else if (validation !== true) {
          // Specialized message(s) if provided
          messages = _.concat(messages, validation);
        }
      });
    }
  });
  return Promise.all(responsesPromises)
  .then(() => {
    return messages.length ? messages : true;
  });
}

/**
 * Transform a list of parameter configurations into a list of inquirer questions
 * @param {Array} parameters - a list of parameter configurations
 * @param {Object} cmdParameterValues - the parameter values that have been set by the command
 * @returns {Array} - a list of inquirer questions
 */
function parametersToQuestions(parameters, cmdParameterValues) {
  const questions = [];

  _.forEach(parameters, parameter => {
    // the question parameter is already an inquirer question
    const question = parameter.question;

    // shortcut if there is no question
    if (!question) { return void 0; }

    // But we can extend it with data that comes from the parameter configuration
    question.default = question.default || parameter.default;
    question.type = question.type || parameter.type;
    question.name = question.name || parameter.name;
    question.message = question.message || parameter.description || parameter.name;
    if (!question.choices && parameter.choices) {
      if (_.isFunction(parameter.choices)) {
        question.choices = answers => {
          // When defined at the "question" level, choices() provide the command parameter values as an extra argument
          return parameter.choices(answers, cmdParameterValues);
        };
      } else {
        question.choices = parameter.choices;
      }
    }
    if (!question.validate && parameter.validate) {
      question.validate = (input, answers) => {
        // When defined at the "question" level, validate() provide the command parameter values as an extra argument
        return parameter.validate(input, answers, cmdParameterValues);
      };
    }
    if (!question.when) {
      question.when = (answers) => {
        // Skip the question if the value have been set in the command and no other when() parameter has been defined
        if (!_.startsWith(parameter.cmdSpec, '-') && parameter.cmdSpec.indexOf('...') > -1) {
          // Special case for variadic arguments
          return cmdParameterValues[parameter.name].length === 0;
        }
        return typeof cmdParameterValues[parameter.name] === 'undefined';
      };
    } else {
      const extendedWhen = question.when;
      question.when = (answers) => {
        // When defined at the "question" level, when() provide the command parameter values as an extra argument
        return extendedWhen(answers, cmdParameterValues);
      };
    }
    if (question.default instanceof Function) {
      const extendedDefault = question.default;
      question.default = (answers) => {
        // When defined at the "question" level, when() provide the command parameter values as an extra argument
        return extendedDefault(answers, cmdParameterValues);
      };
    }

    questions.push(question);
  });
  return questions;
}


function fixCommander(commander) {
  /**
   * Parse options from `argv` returning `argv`
   * void of these options.
   *
   * @param {Array} argv
   * @return {Array}
   * @api public
   */
  commander.Command.prototype.parseOptions = function(argv) {
    var args = []
      , len = argv.length
      , literal
      , option
      , arg;

    var unknownOptions = [];

    // parse options
    for (var i = 0; i < len; ++i) {
      arg = argv[i];

      // literal args after --
      if ('--' == arg) {
        literal = true;
        continue;
      }

      if (literal) {
        args.push(arg);
        continue;
      }

      // find matching Option
      option = this.optionFor(arg);

      // option is defined
      if (option) {
        // requires arg
        if (option.required) {
          arg = argv[++i];
          if (null == arg) return this.optionMissingArgument(option);
          this.emit(option.name(), arg);
        // optional arg
        } else if (option.optional) {
          arg = argv[i + 1];
          if (null == arg || ('-' == arg[0] && '-' != arg)) {
            arg = null;
          } else {
            ++i;
          }
          this.emit(option.name(), arg);
        // bool
        } else {
          this.emit(option.name());
        }
        continue;
      }

      // looks like an option
      if (arg.length > 1 && '-' == arg[0]) {
        unknownOptions.push(arg);

        // If the next argument looks like it might be
        // an argument for this option, we pass it on.
        // If it isn't, then it'll simply be ignored
        if ((argv[i + 1] || argv[i + 1] === '') && '-' != argv[i + 1][0]) {
          unknownOptions.push(argv[++i]);
        }
        continue;
      }

      // arg
      args.push(arg);
    }

    return { args: args, unknown: unknownOptions };
  };
}
