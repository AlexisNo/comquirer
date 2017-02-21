/*eslint-env mocha */
'use strict';

const icli = require('..');

const config = {
  cmd: 'burger',
  description: 'create your burger',
  parameters: [{
    cmdSpec: '[name]',
    type: 'input',
    validate: (v) => { return /^[a-zA-Z0-9 -]+$/.test(v); },
    question: {
      message: 'How do you want to name your burger?'
    }
  }, {
    cmdSpec: '-s, --sauces <sauces-list>',
    description: 'A comma-separated list of sauces',
    type: 'checkbox',
    choices: ['bbq', 'ketchup', 'mayonnaise', 'mustard', 'spicy'],
    question: {
      message: 'Choose your sauce(s)'
    }
  }, {
    cmdSpec: '--vege',
    description: 'Check if vegetarian',
    type: 'bool',
    default: false,
    question: {
      message: 'Are you vegetarian?'
    }
  }, {
    cmdSpec: '-b, --bacon <none|simple|double|triple>',
    description: 'Select the quantity of bacon',
    type: 'list',
    choices: () => {
      return new Promise(resolve => {
        setTimeout(() => { resolve(['none', 'simple', 'double', 'triple']); }, 200);
      });
    },
    default: 'simple',
    question: {
      message: 'What quantity of bacon do you want?',
      when: (answers, cmdParameterValues) => {
        return cmdParameterValues.vege !== true && answers.vege !== true && cmdParameterValues.bacon === undefined;
      }
    },
  }, {
    cmdSpec: '--salad',
    description: 'Add salad',
    type: 'confirm',
    default: false,
    question: {
      message: 'Do you want some salad?'
    }
  }, {
    cmdSpec: '--tomato',
    description: 'Add tomato',
    type: 'boolean',
    question: {
      message: 'Do you want some tomato?'
    }
  }, {
    cmdSpec: '--steaks <quantity>',
    description: 'Number of steaks',
    type: 'integer',
    question: {
      message: 'How many steaks do you want?',
      when: (answers, cmdParameterValues) => {
        return cmdParameterValues.vege !== true && answers.vege !== true && cmdParameterValues.bacon === undefined;
      }
    }
  }, {
    cmdSpec: '--drink-size <quantity>',
    description: 'Size of the drink im ml',
    type: 'int',
    question: {
      message: 'What size do you want your drink?'
    }
  }, {
    cmdSpec: '-p, --price <estimated-price>',
    description: 'Price you are willing to pay',
    type: 'number',
    question: {
      message: 'How much are you willing to pay?'
    }
  }, {
    cmdSpec: '--satisfaction <comment>',
    description: 'Tell us if you are happy',
    type: 'input',
    question: {
      validate: () => { return true; }
    }
  }, {
    cmdSpec: '-u',
    description: 'Useless option'
  }],
  commanderActionHook() {
    // Here you can transform the data passed to commander's action() callback and return it
    return arguments;
  },
  inquirerPromptHook(answers, commandParameterValues) {
    // Here you can transform the data promised by inquirer
    // Additionally, parameters provided in the command line are available
    return Promise.resolve([answers, commandParameterValues]);
  },
  execute: parameters => {
    // The argument of this callback function is the aggregation of parameter values from the command and from the prompt
    // Comquirer comes with a small helper to colorize text
    console.log('The ' + icli.format.info(parameters.name) + ' burger is in preparation ...');
    const burger = parameters;
    console.log('Have a nice meal!');
    // syntax highlighting is performed by cardinal
    console.log(icli.highlight(JSON.stringify(burger, null, 2), { json: true }));
  }
};
icli.createSubCommand(config);

icli.getProgram().parse(process.argv);
