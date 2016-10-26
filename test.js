/*eslint-env mocha */
'use strict';

const assert = require('assert');
const icli = require('.');

describe('Comquire', function() {

  it('should colorize portions of text', () => {
    assert.equal(icli.format.cmd('a command'), '\x1b[33ma command\x1b[0m', 'commands are colorised');
    assert.equal(icli.format.info('an info'), '\x1b[36man info\x1b[0m', 'information is colorised');
    assert.equal(icli.format.error('an error'), '\x1b[31man error\x1b[0m', 'errors are colorised');
    assert.equal(icli.format.success('a success message'), '\x1b[32ma success message\x1b[0m', 'success messages are colorised');
    assert.equal(icli.format.custom('a custom message', '\x1b[35m'), '\x1b[35ma custom message\x1b[0m', 'it is possible to customize text format');
    assert.equal(icli.format.ok('ok'), '\x1b[32mok\x1b[0m', '"ok" messages are colorised');
    assert.equal(icli.format.ko('ko'), '\x1b[31mko\x1b[0m', '"ko" messages are colorised');
  });

  it('should transform a configuration object into a command and a prompt', function(done) {
    const command = [
      '/path/to/node', 'file.js', 'burger',
      'my-burger',
      '--tomato',
      '--salad',
      '--steaks', '3',
      '-p', '12.5',
      '--bacon', 'double',
      '--sauces', 'mustard,ketchup'
    ];
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
        cmdSpec: '-b, --bacon <none|simple|double|triple>',
        description: 'Select the quantity of bacon',
        type: 'list',
        choices: ['none', 'simple', 'double', 'triple'],
        default: 'simple',
        question: {
          message: 'What quantity of bacon do you want?'
        }
      }, {
        cmdSpec: '--salad',
        description: 'Add salad',
        type: 'bool',
        default: false,
        question: {
          message: 'Do you want some salad?'
        }
      }, {
        cmdSpec: '--tomato',
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
      }, {
        cmdSpec: '-p, --price <estimated-price>',
        description: 'Price you are willing to pay',
        type: 'number',
        question: {
          message: 'How much are you willing to pay?'
        }
      }],
      commanderActionHook() {
        // Here you can transform the data passed to commander's action() callback and return it
        return arguments;
      },
      inquirerPromptHook(answers, commandParameterValues) {
        // Here you can transform the data promised by inquirer
        // Additionally, parameters provided in the command line are available
        return Promise.resolve([answers, commandParameterValues]);
      }
    };
    icli.createSubCommand(config, parameters => {
      try {
        assert.equal(parameters.name, command[3], 'the "name" argument is set correctly');
        assert.equal(parameters.tomato, true, 'the "tomato" option is set correctly');
        assert.equal(parameters.salad, true, 'the "salad" option is set correctly');
        assert.equal(parameters.steaks, 3, 'the "steaks" option is set correctly');
        assert.equal(parameters.bacon, 'double', 'the "bacon" option is set correctly');
        assert.equal(parameters.sauces.join(','), 'mustard,ketchup', 'the "sauces" option is set correctly');
        done();
      } catch (e) {
        done(e);
      }
    });

    icli.getProgram().parse(command);
  });

});
