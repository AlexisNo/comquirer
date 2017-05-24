Comquirer
===

[![Build Status](https://travis-ci.org/AlexisNo/comquirer.svg?branch=master)](https://travis-ci.org/AlexisNo/comquirer)
[![bitHound Overall Score](https://www.bithound.io/github/AlexisNo/comquirer/badges/score.svg)](https://www.bithound.io/github/AlexisNo/comquirer)
[![bitHound Dependencies](https://www.bithound.io/github/AlexisNo/comquirer/badges/dependencies.svg)](https://www.bithound.io/github/AlexisNo/comquirer/master/dependencies/npm)
[![bitHound Code](https://www.bithound.io/github/AlexisNo/comquirer/badges/code.svg)](https://www.bithound.io/github/AlexisNo/comquirer)
[![codecov](https://codecov.io/gh/AlexisNo/comquirer/branch/master/graph/badge.svg)](https://codecov.io/gh/AlexisNo/comquirer)

Define a command line and a prompt in one single configuration.

Quickly create commands that can be scripted AND user friendly using prompt to choose arguments and options values.

Comquirer is just a small wrapper of [commander](https://github.com/tj/commander.js/) and [inquirer](https://github.com/SBoudrias/Inquirer.js/)
that helps you to simplify their association.

`Commander` arguments and options are transformed into a hash of parameter keys <=> values. Then, parameters that do not have been provided in the command line
are asked in an `inquirer` prompt. It is possible to configure a parameter to be set only with an argument/option or only with a question.

```javascript
const icli = require('comquirer');
const packageJson = require('./package.json');

// It is possible to access directly to the commander instance
icli.getProgram().version(packageJson.version);

const config = {
  cmd: 'burger',
  description: 'create your burger',
  parameters: [{
    cmdSpec: '[name]',
    type: 'input',
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
    question: {
      message: 'Are you vegetarian?'
    }
  }, {
    cmdSpec: '-b, --bacon <none|simple|double|triple>',
    description: 'Select the quantity of bacon',
    type: 'list',
    choices: ['none', 'simple', 'double', 'triple'],
    question: {
      message: 'What quantity of bacon do you want?'
    }
  }, {
    cmdSpec: '--salad>',
    description: 'Add salad',
    type: 'bool',
    question: {
      message: 'Do you want some salad?'
    }
  }, {
    cmdSpec: '--tomato>',
    description: 'Add tomato',
    type: 'bool',
    question: {
      message: 'Do you want some tomato?'
    }
  }, {
    cmdSpec: '--steaks <quantity>',
    description: 'Number of steaks',
    type: 'integer',
    question: {
      message: 'How many steaks do you want?'
    }
  }],
  commanderActionHook() {
    // Here you can transform the data passed to commander's action() callback
    // and return it
    return arguments;
  },
  inquirerPromptHook(answers, commandParameterValues) {
    // Here you can transform the data promised by inquirer
    // Additionally, parameters provided in the command line are available
    return Promise.resolve([answers, commandParameterValues]);
  }
};

icli.createSubCommand(config, parameters => {
  // The argument of this callback function is the aggregation of parameter values from the command and from the prompt

  // Comquirer comes with a small helper to colorize text
  console.log('The ' + icli.format.info(parameters.name) + ' burger is in preparation ...')

  return burgerLib.doABurger(parameters)
  .then(burger => {
    console.log('Have a nice meal!');
    // syntax highlighting is performed by cardinal
    console.log(icli.highlight(JSON.stringify(burger, null, 2), { json: true }));
    // The result is available in a Promise returned by icli.parse()
    return burger
  });
});

// Call the parse() method of commander to begin the execution
icli.parse(process.argv)
.then(myBurger => {
  // This code is executed after 
});
```
