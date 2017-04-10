/*eslint-env mocha */
'use strict';

const assert = require('assert');
const icli = require('.');

const commandConfig = {
  cmd: 'burger',
  description: 'create your burger',
  throwErrors: true,
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
    }
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
  }]
};

describe('Comquirer', function() {

  it('should colorize portions of text', () => {
    assert.equal(icli.format.cmd('a command'), '\x1b[33ma command\x1b[0m', 'commands are colorised');
    assert.equal(icli.format.info('an info'), '\x1b[36man info\x1b[0m', 'information is colorised');
    assert.equal(icli.format.error('an error'), '\x1b[31man error\x1b[0m', 'errors are colorised');
    assert.equal(icli.format.success('a success message'), '\x1b[32ma success message\x1b[0m', 'success messages are colorised');
    assert.equal(icli.format.custom('a custom message', '\x1b[35m'), '\x1b[35ma custom message\x1b[0m', 'it is possible to customize text format');
    assert.equal(icli.format.ok('ok'), '\x1b[32mok\x1b[0m', '"ok" messages are colorised');
    assert.equal(icli.format.ko('ko'), '\x1b[31mko\x1b[0m', '"ko" messages are colorised');
  });


  it('should perform syntax highlight', () => {
    // eslint-disable-next-line max-len
    assert.equal(icli.highlight('{ a: \'b\', c: 123 }'), '\u001b[33m{\u001b[39m \u001b[37ma\u001b[39m\u001b[93m:\u001b[39m \u001b[92m\'b\'\u001b[39m\u001b[32m,\u001b[39m \u001b[37mc\u001b[39m\u001b[93m:\u001b[39m \u001b[34m123\u001b[39m \u001b[33m}\u001b[39m');
  });


  it('should transform a configuration object into a command and a prompt', function() {
    const command = [
      '/path/to/node', 'file.js', 'burger',
      'my-burger',
      '--tomato',
      '--salad',
      '--steaks', '3',
      '--drink-size', '200',
      '-p', '12.5',
      '--bacon', 'double',
      '--sauces', 'mustard,ketchup',
      '--vege',
      '--satisfaction', 'very happy'
    ];
    commandConfig.execute = (parameters, done) => {
      assert.equal(parameters.name, command[3], 'the "name" argument is set correctly');
      assert.equal(parameters.tomato, true, 'the "tomato" option is set correctly');
      assert.equal(parameters.salad, true, 'the "salad" option is set correctly');
      assert.equal(parameters.steaks, 3, 'the "steaks" option is set correctly');
      assert.equal(parameters.drinkSize, 200, 'the "drink-size" option is set correctly');
      assert.equal(parameters.bacon, 'double', 'the "bacon" option is set correctly');
      assert.equal(parameters.sauces.join(','), 'mustard,ketchup', 'the "sauces" option is set correctly');
      done(null, parameters);
    };
    const execDonePromise = icli.createSubCommand(commandConfig);
    icli.getProgram().parse(command);
    return execDonePromise.then(burger => {
      assert.equal(burger.name, command[3], 'the "name" argument is set correctly');
      assert.equal(burger.tomato, true, 'the "tomato" option is set correctly');
      assert.equal(burger.salad, true, 'the "salad" option is set correctly');
      assert.equal(burger.steaks, 3, 'the "steaks" option is set correctly');
      assert.equal(burger.drinkSize, 200, 'the "drink-size" option is set correctly');
      assert.equal(burger.bacon, 'double', 'the "bacon" option is set correctly');
      assert.equal(burger.sauces.join(','), 'mustard,ketchup', 'the "sauces" option is set correctly');
    });
  });


  it('should accept the execution function as a second arugment', function() {
    const command = [
      '/path/to/node', 'file.js', 'another-burger',
      'my-burger',
      '--tomato',
      '--salad',
      '--steaks', '3',
      '--drink-size', '200',
      '-p', '12.5',
      '--bacon', 'double',
      '--sauces', 'mustard,ketchup',
      '--vege',
      '--satisfaction', 'very happy'
    ];
    commandConfig.cmd = 'another-burger';
    delete commandConfig.execute;
    const execDonePromise = icli.createSubCommand(commandConfig, (parameters, done) => {
      assert.equal(parameters.name, command[3], 'the "name" argument is set correctly');
      assert.equal(parameters.tomato, true, 'the "tomato" option is set correctly');
      assert.equal(parameters.salad, true, 'the "salad" option is set correctly');
      assert.equal(parameters.steaks, 3, 'the "steaks" option is set correctly');
      assert.equal(parameters.drinkSize, 200, 'the "drink-size" option is set correctly');
      assert.equal(parameters.bacon, 'double', 'the "bacon" option is set correctly');
      assert.equal(parameters.sauces.join(','), 'mustard,ketchup', 'the "sauces" option is set correctly');
      done(null, parameters);
    });
    icli.getProgram().parse(command);
    return execDonePromise.then(burger => {
      assert.equal(burger.name, command[3], 'the "name" argument is set correctly');
      assert.equal(burger.tomato, true, 'the "tomato" option is set correctly');
      assert.equal(burger.salad, true, 'the "salad" option is set correctly');
      assert.equal(burger.steaks, 3, 'the "steaks" option is set correctly');
      assert.equal(burger.drinkSize, 200, 'the "drink-size" option is set correctly');
      assert.equal(burger.bacon, 'double', 'the "bacon" option is set correctly');
      assert.equal(burger.sauces.join(','), 'mustard,ketchup', 'the "sauces" option is set correctly');
    });
  });

  it('should reject the Promise returned by createSubCommand() if needed', function() {
    const command = [
      '/path/to/node', 'file.js', 'another-burger-again',
      'my-burger',
      '--tomato',
      '--salad',
      '--steaks', '3',
      '--drink-size', '200',
      '-p', '12.5',
      '--bacon', 'double',
      '--sauces', 'mustard,ketchup',
      '--vege',
      '--satisfaction', 'very happy'
    ];
    commandConfig.cmd = 'another-burger-again';
    commandConfig.execute = (parameters, done) => {
      done(new Error('Fail for some reason'));
    };
    const execDonePromise = icli.createSubCommand(commandConfig);
    icli.getProgram().parse(command);

    return execDonePromise.then(() => {
      throw new Error('This code should not be reached');
    })
    .catch(e => {
      // We expect to catch an error here
      assert.equal(e.message, 'Fail for some reason');
      return Promise.resolve();
    });
  });


  it('should reject the Promise returned by createSubCommand() if something went wrong during the parsing', function() {
    const command = [
      '/path/to/node', 'file.js', 'another-bad-burger',
      'my_burger',
      '--tomato',
      '--salad',
      '--steaks', '3',
      '--drink-size', 'xxx',
      '-p', '12.5o',
      '--bacon', 'zzz',
      '--sauces', 'xxx,yyy',
      '--vege',
      '--satisfaction', 'very happy'
    ];
    commandConfig.cmd = 'another-bad-burger';
    commandConfig.commanderActionHook = function() {
      return arguments;
    };
    commandConfig.inquirerPromptHook = (answers, commandParameterValues) => {
      return Promise.resolve([answers, commandParameterValues]);
    };
    commandConfig.execute = parameters => {
      throw new Error('This code should not be reached 1');
    };
    const execDonePromise = icli.createSubCommand(commandConfig);
    icli.getProgram().parse(command);

    return execDonePromise.then(() => {
      throw new Error('This code should not be reached 2');
    })
    .catch(e => {
      // We expect to catch an error here
      const messages = e.message.split('\n');
      assert.equal(messages.length, 6);
      return Promise.resolve();
    });
  });
});
