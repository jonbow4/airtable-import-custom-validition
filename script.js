// define the tables
let importTable = base.getTable('Import');
let rejectsTable = base.getTable('Import Rejects');
let conditionsTable = base.getTable('Conditions');

// get the fields in the Import table
let importTableFields = importTable.fields;

// create an empty array to contain the import conditions
let conditionsArray = [];

// ask the user to define conditions for the import
// this will loop until the user says "no more conditions"
let newCondition = await input.buttonsAsync('Would you like to add an import condition?', ['Yes', 'No']);
while (newCondition === 'Yes') {
    let contains = '';
    let field = await input.fieldAsync("Pick a field", importTable);
    let condition = await input.recordAsync('Pick a condition', conditionsTable);
    if (condition.name == 'Must contain') {
        contains = await input.textAsync('Must contain')
    }
    conditionsArray.push(
        {
        field: field.name,
        condition: condition.name,
        contains: contains
        }
    )
    let anotherCondition = await input.buttonsAsync('Would you like to add another import condition?', ['Yes', 'No']);
    if (anotherCondition === 'No') {
        newCondition = 'No'
    }
}

// turn the entered conditions into a form where they can be evaluated against the records
let myConditions = '';
for (let c of conditionsArray) {
    if (c.condition == 'Is not empty') {
        if (myConditions.length == 0) {
            myConditions = 'record[\'' + c.field + '\']';
        } else {
            myConditions = myConditions + ' && record[\'' + c.field + '\']';
        }
    }
    if (c.condition == 'Must be an email') {
        if (myConditions.length == 0) {
            myConditions = 'emailIsValid(record[\'' + c.field + '\'])';
        } else {
            myConditions = myConditions + ' && emailIsValid(record[\'' + c.field + '\'])';
        }
    }
    if (c.condition == 'Must contain') {
        if (myConditions.length == 0) {
            myConditions = 'record[\'' + c.field + '\']' + '.includes("' + c.contains + '")';
        } else {
            myConditions = myConditions + ' && record[\'' + c.field + '\']' + '.includes("' + c.contains + '")';
        }
    }

}

// print our the configured conditions
output.text('========================')
output.text('You have configured the following conditions:')
for (let rule of conditionsArray) {
    output.text(`${rule.field} ${rule.condition} ${rule.contains}`)
}
output.text('========================')

// get the suer to pick a file to import
let fileResult = await input.fileAsync(
    'Import a CSV file with header row',
    {
        allowedFileTypes: ['.csv'],
        hasHeaderRow: true
    }
);

// parse the file contents
let records = fileResult.parsedContents;

// for each record in the parsed contents
for (let record of records) {
    // if the records passes against the conditions
    if (eval(myConditions)) {
        // try to import it
        try {
            let newRecord = await importTable.createRecordAsync(record);
            console.log('New record imported');
        // but get the error if there is an Airtable validation error
        } catch (e) {
            // in which case, turn the record into a string and push it into the rejects table
            let rejectedRecord = Object.keys(record).map(function(k){return record[k]}).join(",");
            let newRecord = await rejectsTable.createRecordAsync({
                Record: rejectedRecord,
                Reason: 'Airtable standard validation: ' + e['message']
            });
            console.log('Record rejected by Airtable');
        }
    // otherwise...(if it DOESN'T pass against the conditions)
    } else {
        // turn the record into a string and push it to the rejects table
        let rejectedRecord = Object.keys(record).map(function(k){return record[k]}).join(",");
        let newRecord = await rejectsTable.createRecordAsync({
            Record: rejectedRecord,
            Reason: 'Custom validation error'
        });
        console.log('Record rejected by custom validation rules');
    }
}


// basic email validity checker
function emailIsValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
