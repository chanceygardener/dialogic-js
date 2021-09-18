const {
  mkdirSync, openSync, unlinkSync, rmdirSync,
} = require('fs');
const { join } = require('path');
const { NlgRealizer } = require('../src/realizer.js');
const { readJson } = require('../src/utils.js');
const History = require('../src/history');

// TODO(CSB-380): fill out
// this structure when the
// component generating methods of the
// constructor get realized
const expectedLogic = {
  InventoryQuery: {
    args: {
      num_items: {
        type: 'num',
        description: 'The number of specified items that can be found in the inventory',
        required: true,
      },
      item_singular: {
        type: 'str',
        description: 'the singular form of the item in question',
        required: false,
      },
      item_plural: {
        type: 'str',
        description: 'the plural form of the item in question',
        required: true,
      },
    },
    description: 'The user is asking how many of a certain item exists in the inventory.',
  },
  FindYourThing: {
    args: {
      negated: {
        type: 'bool',
        description: 'A boolean value describing whether or not',
      },
      item_name: {
        type: 'str',
      },
      location: {
        type: 'str',
      },
    },
    description: 'The user has asked the digital person to find something of theirs',
  },
};
const expectedTemplates = {
  inventory: {
    InventoryQuery: {
      switch: true,
      forms: [
        {
          text: "It [_seemSynset] we've [_onlyIfOne num_items=$num_items] got ($num_items) [_countNp num_items=$num_items singular_form=$item_singular plural_form=$item_plural] in stock",
          conditions: [
            '$num_items > 0',
          ],
        },
        {
          text: "Sorry to say it [_seemSynset] we don't have any $item_plural in stock.",
        },
      ],
    },
    _seemSynset: {
      forms: [
        {
          text: 'seems [_maybeLikeOrThat]',
        },
        {
          text: 'looks like',
        },
        {
          text: 'appears [_maybeThat]',
        },
      ],
    },
    _maybeLikeOrThat: {
      forms: [
        {
          text: 'like',
        },
        {
          text: 'that',
        },
        {
          text: '',
        },
      ],
    },
    _maybeThat: {
      forms: [
        {
          text: 'that',
        },
        {
          text: '',
        },
      ],
    },
    _onlyIfOne: {
      switch: true,
      forms: [
        {
          text: 'only',
          conditions: [
            '$num_items == 2',
          ],
        },
        {
          text: '',
        },
      ],
    },
    _countNp: {
      switch: true,
      forms: [
        {
          text: '$num_items $singular_form',
          conditions: [
            '$num_items == 1',
          ],
        },
        {
          text: '$num_items $plural_form',
        },
      ],
    },
  },
  sample: {
    FindYourThing: {
      switch: true,
      forms: [
        {
          text: 'I [_doOrDoNot val=$negated] know where to find your [_collection item_name=$item_name], [_locationOrFail location=$location].',
          conditions: [
            '{Set $loc} && !$negated',
          ],
          setVal: [
            {
              type: 'string',
              value: 'location_unknown',
            },
          ],
        },
      ],
    },
    _doOrDoNot: {
      switch: true,
      forms: [
        {
          text: "don't",
          conditions: [
            '$val',
          ],
        },
        {
          text: 'do',
          conditions: [

          ],
        },
      ],
    },
    _collection: {
      switch: false,
      forms: [
        {
          text: '$item_name',
          conditions: [

          ],
        },
        {
          text: 'beloved {item_name}',
          conditions: [

          ],
        },
      ],
    },
    _locationOrFail: {
      switch: true,
      forms: [
        {
          text: "but I can't tell you where right now.",
          condition: [
            "$location == 'FAIL'",
          ],
        },
        {
          text: "it's at {location}",
        },
      ],
    },
  },
};

describe('realizer readTemplatesFromDirectory '
    + 'static method reads correctly.', () => {
  it('test data is read from file.', () => {
    expect.assertions(2);
    const testPath = './__tests__/data/templates/golden';
    const {
      templateLookup,
      schemaMap,
    } = NlgRealizer
      .readTemplateFromDirectory(testPath);
    const schemaMapGolden = {
      InventoryQuery: 'inventory',
      FindYourThing: 'sample',
    };
    expect(schemaMap)
      .toMatchObject(
        schemaMapGolden,
      );
    const templateLookupGolden = {
      inventory: readJson(join(testPath,
        'content', 'inventory.template.json')).templates,
      sample: readJson(join(testPath,
        'content', 'sample.template.json')).templates,
    };
    expect(templateLookup)
      .toMatchObject(templateLookupGolden);
  });
});

describe('realizer initializes', () => {
  it('realizer initializes with correct data', () => {
    expect.assertions(2);
    const testPath = './__tests__/data/templates/golden';
    const testRealizer = new NlgRealizer(testPath);
    expect(testRealizer.schema)
      .toMatchObject(expectedLogic);
    expect(testRealizer.templates)
      .toMatchObject(expectedTemplates);
  });
  it('realizer fails on invalid directory structure', () => {
    expect.assertions(5);
    const errPath = './__tests__/data/templateErr';
    try {
      mkdirSync(errPath);
      // assert failure on absence of schema or content entries
      expect(() => {
        const errTest = new NlgRealizer(errPath);
        return errTest;
      })
        .toThrow(Error);

      // Test checks to err out when
      // schema and content are files
      // instead of directories
      const schemaErrPath = join(errPath, 'schema');
      openSync(schemaErrPath, 'w');
      expect(() => {
        const errTest = new NlgRealizer(errPath);
        return errTest;
      })
        .toThrow(Error);
      const contentErrPath = join(errPath, 'content');
      openSync(contentErrPath, 'w');
      expect(() => {
        const errTest = new NlgRealizer(errPath);
        return errTest;
      })
        .toThrow(Error);

      // cleanup
      unlinkSync(contentErrPath);
      unlinkSync(schemaErrPath);

      // now test for intended failures on
      // empty logic directories.
      mkdirSync(schemaErrPath);
      expect(() => {
        const errTest = new NlgRealizer(errPath);
        return errTest;
      })
        .toThrow(Error);
      // test check beginning @ line 58
      // in case of missing content but present
      // schema
      mkdirSync(contentErrPath);
      expect(() => {
        const errTest = new NlgRealizer(errPath);
        return errTest;
      })
        .toThrow(Error);
    } finally {
    // clean up
      rmdirSync(errPath, { recursive: true });
    }
  });

  it('throws error when content and schema names are mismatched', () => {
    expect.assertions(1);
    const mismatchPath = './__tests__/data/mismatched_templates';
    expect(() => {
      const errTest = new NlgRealizer(mismatchPath);
      return errTest;
    }).toThrow(Error);
  });
});

describe(
  'subtemplate invocation generates a correct sub environment from parameter passing in subtemplate invocation',
  () => {
    const testPath = './__tests__/data/templates/golden';
    const realizer = new NlgRealizer(testPath);
    const invocation = '[acknowledgeBalancePositiveOrNegative num_credits=$user_credits user_name=$user_name]';
    const env = {
      user_credits: 3,
      user_name: 'Elanna',
    };
    const subEnv = NlgRealizer.subEnvFromCall(invocation.slice(1, -1), env);
    it('sub environment is correctly generated from subtemplate invocation', () => {
      expect.assertions(1);
      expect(subEnv).toMatchObject(
        {
          num_credits: 3,
          user_name: 'Elanna',
        },
      );
    });
    it('expect parameter references not defined in the upstairs environment to return null',
      () => {
        expect.assertions(1);
        const badEnv = {
          credits: 3,
          user_name: 3,
        };
        const nullSubEnv = NlgRealizer.subEnvFromCall(
          invocation.slice(1, -1), badEnv,
        );
        expect(nullSubEnv).toMatchObject({
          num_credits: null,
          user_name: 3,
        });
      });

    it('expect evaluateVariantText to realize a flat (non recursive) template with variable references to the correct condition and with the correct text.',
      () => {
        expect.assertions(1);
        const testVariant = {
          text: 'Ok ($user_name), it looks like you\'ve got ($user_credits) credits left',
        };
        expect(realizer
          .evaluateVariantText(testVariant,
            env)).toStrictEqual(
          "Ok Elanna, it looks like you've got 3 credits left",
        );
      });
    it('entire upper environment in an upper level template is passed to a subtempalte with the invocation _env=$_env', () => {
      expect.assertions(1);
      const envPassRealizer = new NlgRealizer('./__tests__/data/templates/golden');
      expect(envPassRealizer.executeTemplate('0.0-testPassingWholeEnv', {
        firstValue: 'Jerry Garcia\'s teddy bear',
        secondValue: 'a literal broom',
      }).responseText)
        .toStrictEqual('I got this value: Jerry Garcia\'s teddy bear from an implicit env pass, and I got a literal broom there too.');
    });
    it('attempt to pass an env that is not an object throws an error', () => {
      expect.assertions(1);
      expect(() => {
        const envPassRealizer = new NlgRealizer('./__tests__/data/templates/golden');
        envPassRealizer.executeTemplate('0.0-testPassingWholeEnvNonObj', {
          firstValue: 'Jerry Garcia\'s teddy bear',
          secondValue: 'a literal broom',
        });
      }).toThrow('Value passed to _env must be an object type\n\tOriginal callstring: _env=$firstValue');
    });
  },
);

describe('realizer constructor forbids templates with restricted names upon construction', () => {
  it('import cannot be used as a template name', () => {
    expect.assertions(1);
    /* eslint-disable no-unused-vars */
    expect(() => { const realizer = new NlgRealizer('./__tests__/data/templates/keyword_used'); })
      .toThrow('Cannot name template "import", this is a reserved word. Found in domain sample');
    /* eslint-enable no-unused-vars */
  });
});

describe('executeTemplate realizes correctly.', () => {
  // TODO(CSB-382): write tests for the output structure
  // once executeTemplate is written
  const testPath = './__tests__/data/templates/golden';
  const realizer = new NlgRealizer(testPath);
  const env = {
    num_items: '4',
    item_plural: 'lyres',
    item_singular: 'lyre',
  };
  it('executeTemplate fails for nonexistent template.',
    () => {
      expect.assertions(1);
      expect(() => {
        realizer.executeTemplate('nonExistent');
      }).toThrow(Error);
    });
  it('invalid fulfillment request argument structures fail, determined by template schema',
    () => {
      expect.assertions(2);
      // see data/inventory_schema.json for comparison schemas
      // missing a non required argument
      const validEnv = {
        num_items: 4,
        item_plural: 'lyres',
      };
      // missing a required argument
      const invalidEnv = {
        item_singular: 'lyre',
        item_plural: 'lyres',
      };
      expect(realizer.validateRequestParameters(
        'InventoryQuery', validEnv,
      )).toBe(true);
      expect(realizer.validateRequestParameters(
        'InventoryQuery', invalidEnv,
      )).toBe(false);
    });
  it('inventoryQuery realizes as expected with subtemplate invocations',
    () => {
      expect.assertions(1);
      const templateOutput = realizer.executeTemplate('InventoryQuery', env);
      expect(templateOutput.responseText).toMatch(/^It.*got.*in stock$/);
    });
  it('realizer initiates historyInstance',
    () => {
      expect.assertions(2);
      const templateOutput = realizer.executeTemplate('InventoryQuery', env);
      expect('historyInstance' in templateOutput).toStrictEqual(true);
      expect(templateOutput.historyInstance instanceof History).toStrictEqual(true);
    });
  it('realizer records history steps',
    () => {
      expect.assertions(2);
      const templateOutput = realizer.executeTemplate('InventoryQuery', env);
      expect(templateOutput.historyInstance.threadOrder).toHaveLength(2);
      expect(templateOutput.historyInstance.nodeOrder).toHaveLength(1);
    });
  it('duplicate template across multiple content files throw appropriate error',
    () => {
      expect.assertions(1);
      const badPath = './__tests__/data/templates/duplicate_between';
      expect(() => {
        const dupeRealizer = new NlgRealizer(
          badPath,
        );
        return dupeRealizer;
      }).toThrow('Multiple schema templates found across files for key: InventoryQuery');
    });
  it('imported template realizes from within the target domain',
    () => {
      expect.assertions(2);
      const importRealizer = new NlgRealizer('./__tests__/data/templates/golden');
      expect(importRealizer.executeTemplate('ImportTest', {}).responseText)
        .toStrictEqual('I come from another domain!');
      expect(() => { importRealizer.executeTemplate('ImportTestToFail', {}); })
        .toThrow('Handling procedure for intent: notImported not found in template set or template imports.');
    });
  it('basicList realizes correctly, indicating correct handling of array slicing and indexing',
    () => {
      expect.assertions(1);
      const listRealizer = new NlgRealizer('./__tests__/data/templates/golden');
      const basicListOutput = listRealizer.executeTemplate('0.0-basicList', {
        sequence: ['this', 'that', 'the other'], conjunction: null,
      });
      expect(basicListOutput.responseText).toStrictEqual('this, that, and the other');
    });
  it('np realizes a lexicon entry correctly', () => {
    expect.assertions(3);
    const moonLanding = {
      text: 'the person who faked the moon landing',
      entity_type: null,
      pos: 'NOUN',
      root_word: 'person',
      requires_definite_determiner: true,
      begins_with_vowel_sound: false,
      np_modifiers: {
        RC: [
          'who faked the moon landing',
        ],
        PP: [],
      },
      singular: 'person who faked the moon landing',
      singular_short: 'person',
      plural: 'people who faked the moon landing',
      plural_short: 'people',
    };
    const bobRoss = {
      text: 'Bob Ross',
      entity_type: 'PERSON',
      pos: 'PROPN',
      root_word: 'Ross',
      requires_definite_determiner: false,
      begins_with_vowel_sound: false,
      np_modifiers: {
        RC: [],
        PP: [],
      },
      singular: 'Bob Ross',
      plural: 'Bob Ross',
    };
    const vowelLex = {
      text: 'The executioner on the payroll',
      entity_type: null,
      pos: 'NOUN',
      root_word: 'executioner',
      requires_definite_determiner: true,
      begins_with_vowel_sound: true,
      np_modifiers: {
        RC: [],
        PP: [
          'on the payroll',
        ],
      },
      singular: 'executioner on the payroll',
      singular_short: 'executioner',
      plural: 'executioners on the payroll',
      plural_short: 'executioners',
    };
    const npRealizer = new NlgRealizer('./__tests__/data/templates/golden');
    expect(npRealizer.executeTemplate('0.0-testNpLex',
      { test_entity: moonLanding }).responseText)
      .toStrictEqual('the people who faked the moon landing are some people I find very shady. I wouldn\'t trust such a person, even if some people who faked the moon landing are considered trustworthy, I wouldn\'t trust such a person.');
    expect(npRealizer.executeTemplate('0.0-testNpLexPerson', { test_entity: bobRoss }).responseText).toStrictEqual('Bob Ross is an unrecognized saint');
    expect(npRealizer.executeTemplate('0.0-testNpLexBeginsWithVowel', { test_entity: vowelLex }).responseText).toStrictEqual('an executioner on the payroll is not a good look for a knitting club.');
  });
  it.todo('Correct variant is selected with switch set to true');
  it.todo('literal argument passes from template to subtemplate behave as expected');
});
