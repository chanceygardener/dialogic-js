# Dialogic Template NLG Framework for Virtual Agents

## Overview
The purpose of this project is to provide a framework to orchestrate parameters to be used to modulate speech output in a compositionally varied, hierarchical manner to create dynamic, varied, more human like speech. These templates can be used to vary speech style as a function of user sentiment analysis values, to produce correct linguistic morphological inflection, e.g., tense, number, etc., randomly bring up new topics according to configurable constraints, manage dynamic fallback response procedures, and more. Messages are encoded in JSON with a conditioning mini language to create custom logic in which

## [Documentation](https://soulmachines.atlassian.net/l/c/QkF6DAFZ)
Documentation can be found on [the Dialogic architecture Confluence page](https://soulmachines.atlassian.net/l/c/QkF6DAFZ).
Docs are auto-generated from JSDoc blocks and automatically exported to Soul Machines Confluence on pushes to `staging` and `master`. New functionality should be documented inline with [JSDoc style blocks](https://jsdoc.app).

## Realizer Class
The main component of the Dialogic library is the realizer class, which orchestrates template logic and parameters from the NLU engine with which it works to provide a conversational interface, or from other sources. Its constructor is called with a single required argument, which is the file path leading to the message set directory (See the message sets section for more on this). The realizer contains the logic for running template executions, the specific procedures for which are encoded in the message set files. As such, the main method that will be used externally is  ```executeTemplate(templateName env)```
Where templateName corresponds to a top level message template (i.e., one that corresponds to an intent in the NLU model and is defined in the schema file), and env is an object with properties corresponding to the arguments defined in the schema.

## How To Run

### Incoming Fulfillment Requests
This library contains translator functions to turn a fulfillment request for dialogflow into an intent name and environment for the handling procedure (message template) to run. They can be found in the /src/translators.js file, and named in the format "handle\<platformName\>Req." These are the translator functions that are currently implemented:

* ```handleDialogflowReq```

These functions return a structure that can be passed to the realizer to generate an appropriate response. This structure contains the following fields:
* params
	* Parameters passed in the fulfillment request. This field should include the history structure [(TODO (CSB-454) add history to handleDialogflowReq)](https://soulmachines.atlassian.net/browse/CSB-454), from which position it can be operated on by the condition language, and any other parameter values passed along with the fulfillment request. The exact structure of these parameters will vary as a function of the NLU platform being used. For example, in Dialogflow, ```parameters``` will always include a structure called ```contexts```, the parameters of which can be accessed in the condition language via ```$contexts.<contextName>.<value>```.
* session
	* The session ID, this is used internally by the realizer.
* intent
	* The name of the triggered intent.

### Outgoing Fulfillment Responses
Once the request has been handled, the realizer returns a structure with the following keys:
* text
	* The realized response given the intent and parameters
* parameters
	* Usually the same as the input parameters

This structure should then be passed to a response translator, also included in translators.js and are named "handle\<platformName\>Res." These functions return a valid fulfillment response structure expected by the NLU platform for which the specific response translator is implemented.

## Message Sets
The Realizer consumes one or more message sets, which contain templates for the content and logic of a virtual agent's responses. These templates are consumed as a filepath leading to two directories, content and schema, which in turn contain one or more template files and corresponding argument schemas respectively. [TODO (CSB-437): include example lambda function in this repo].
### Anatomy of a message set
#### Template File
This JSON file lives in the content directory directly beneath the path passed to the Realizer's constructor. This file contains two top level keys:
* "name": the name of the message set, which must match the name of the schema file
* "templates": a map of template name keys to values which are formatted with the following keys:
	* "forms": A list of response variations, which are formatted as follows:
		<code>  {
						"text": "What the virtual agent will say if this variant is selected,
						 optionally contains one or more {_SubtemplateInvocation arg=\$argval}",
						"conditions": [
							"\$environmentVariable >= 4"
					]
			}
		</code>
	*  "switch" optional: If true, the realizer will check each template's conditions in order and select the first one to be fulfilled by the environment with respect to which the current template is being realized. If this variant is false, or unspecified, the realizer will choose randomly from the response forms that have either no conditions, or else have conditions that evaluate to true with respect to the environment with respect to which the template is being realized.

##### Subtemplate Invocation and Sub Environments
When the logic of a message template gets invoked, the realizer is passed an environment with parameters coming either from the NLU engine's fulfillment request, or from third party sources. Within the text field, one can invoke other templates in the message set with the following syntax:

```{subTemplateName arg1=$arg1 arg2=$arg2}```

Where the subtemplate will be invoked with an environment containing arguments corresponding to the parameter names as written in the subtemplate invocation. Both top level (i.e., those defined in the schema and corresponding to an intent) and helper templates can be invoked from other intents.
* <b>NOTE:</b> Currently, subtemplates must be unique both within message sets <b>and across all</b> message sets for the moment. We will support duplicate subtemplate names <b>across</b> message sets upon the completion of [CSB-436](https://soulmachines.atlassian.net/browse/CSB-436)

#### Schema File
Schema files live in the "schema" directory directly beneath the root path passed to the realizer's constructor. This JSON file contains two top level keys:
* <b>name</b> (required): the name of the message set, which must match the name field in the corresponding template file.
* <b>schema</b> (required): A map of top level (i.e., intent corresponding) t of template schemas

## Conditioning Mini Language
The "conditions" field of a response form contains a list of statements that operate on variables passed to the realizer as an environment for the template's invocation. This language supports the following operators
### Logical and Comparison Operators
* || : OR
* && : AND
* == : equal
* != : not equal
* < : less than
* < : greater than
* <= : less than or equal to
* \>= : greater than or equal to

**Note:** As you may notice, we do not *currently* support the NOT operator (!) except for in the != comparison operator. Support for ! in all contexts is a known issue tracked in [CSB-441](https://soulmachines.atlassian.net/browse/CSB-441)
### Arithmetic Operators
* \+ : addition
* \- subtraction
* \* : multiplication
* / : division
* \** : exponentiation
* % : modulo

### Variable References
Variables passed into a template's scope (See section on template environments for more detail)
 are accessible to statements in the condition language by their name as defined in the scope, preceded by a dollar sign, $.

### Value Types and Truthiness
Values in condition language statements fall into one of the following types. The final interpreted result of a condition language statement will be evaluated to a boolean value by the rules indicated below.
* **string**
	* Can be variable reference or literal
		*  If it's a literal, it must be enclosed in either ', ", or `
	* **evaluates to:** True if not empty, otherwise False
* **numeric**
	* includes integers and floats
	* * **evaluates to:** True if greater than 0 else False
* **array**
	* Ordered sequences of objects (Type checking for elements of arrays is NOT yet supported)
	* Length of arrays accessible by a built-in ```Length``` function
	* Elements of arrays can be indexed and sliced by the following notation
		```$array[$start:$stop] ```
		take a slice, or subarray of the array from index $start to index $stop

		```$array[$start:]```
		take a slice of the array from index start, to the end of the array

		```$array[:$stop]```
		take a slice of the array from the beginning to index $stop

		```$array[$index] ```
		get the element of the array at index $index
	* **evaluates to:** True if greater than 0 else False
* **object**
	* key - value mapping of arbitrary depth (Type checking for object fields is NOT yet supported)
	* fields can be accessed by either square bracket OR dot notation, that is to say that the following two statements are equivalent
			```object.field```
			```object[field]```
	* **evaluates to:** False if empty, otherwise true.
* **datetime**
	* Passed as an ISO string, the condition language interpreter converts datetime parameters to objects under the hood. This way, values of the datetime, such as month, day, hour, minute, and second can be accessed via dot or square bracket notation as with objects (See above).
	*  **evaluates to:** True. There is no special behavior for datetime objects' truthiness, rather this is inherited from the fact that nonempty objects evaluate to true, which is what a datetime is internally.
## Plugins

The condition language is capable of being augmented with custom functions to suit the needs of the user. By default, we include the following functions

#### IsNull
Return true if the variable passed as argument is not present in the environment, otherwise return false

#### CompareDateTime
Takes two positional datetime objects. Returns -1 if the second is before the first, 0 if they are within 1 minute of each other, and 1 if the second follows the 1st.

#### Length
Gets the length of an array

### Custom Functions
Dialogic supports custom functions as plugins to the condition language interpreter. These functions must return either a boolean or an integer value and take only positional arguments.

### Dialogic Config file.
#### Plugins
This is a javascript file containing a config object which currently contains a single element, a list of plugin functions which will be available from the condition language interpreter.

#### Node name schema (Coming Soon)
This allows dialogic to update the conversation history hierarchically, i.e., with knowledge not only of the linear path of individual dialog nodes, but also with the "threads" or "topics" each node is associated with. This is useful if, say, the user asks the conversational agent what they were recently talking about. Dialogic can, in this case, look through the "thread level" history and respond as a function of the thread as defined in the conversation design.
##### Format
 This field should be a valid regular expression with named capture groups "thread" and "nodeName"