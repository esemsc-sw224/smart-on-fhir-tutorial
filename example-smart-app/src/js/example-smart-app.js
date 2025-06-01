(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        var patient = smart.patient;
        var pt = patient.read();
        var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                      code: {
                        $or: ['http://loinc.org|2339-0',   // Glucose [Mass/volume] in Blood
                              'http://loinc.org|72166-2',  // Tobacco smoking status
                              'http://loinc.org|9279-1',   // GCS total score
                              'http://loinc.org|2093-3',   // Cholesterol, Total
                              'http://loinc.org|8302-2',   // Height
                              'http://loinc.org|3141-9',  // Body weight
                              'http://loinc.org|39156-5',  // BMI
                              'http://loinc.org|55284-4',  // Blood pressure panel
                              'http://loinc.org|2085-9',   // HDL
                              'http://loinc.org|2089-1'  // LDL
                            ]
                      }
                    }
                  });
        $.when(pt, obv).fail(onError);

        $.when(pt, obv).done(function(patient, obv) {
          var byCodes = smart.byCodes(obv, 'code');
          var gender = patient.gender;

          var fname = '';
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family.join(' ');
          }

          var height = byCodes('8302-2');
          var weight = byCodes('3141-9');
          var p_bmi = byCodes('39156-5');
          const birthDate = new Date(patient.birthDate);
          const today = new Date();
          const age = today.getFullYear() - birthDate.getFullYear() - 
                      (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0);
          var glucose = byCodes('2339-0');
          var tobacco = byCodes('72166-2');
          var gcs = byCodes('9279-1');
          var cholesterol = byCodes('2093-3');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');

          var p = defaultPatient();
          p.birthdate = patient.birthDate;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.height = getQuantityValueAndUnit(height[0]);
          p.weight = getQuantityValueAndUnit(weight[0]);
          p.bmi_1 = getBMI(p.height, p.weight);
          p_bmi = getQuantityValueAndUnit(p_bmi[0]);
          p.age = age;
          p.glucose = getQuantityValueAndUnit(glucose[0]);
          p.smoke = getSmokerStatus(tobacco);
          p.gcs = getQuantityValueAndUnit(gcs[0]);
          p.cholesterol = getQuantityValueAndUnit(cholesterol[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

          smart.patient.api.fetchAll({ type: "Condition" }).then(function(conditions) {
            const diabetesCodes = ['E10', 'E11', 'E13', '44054006', '46635009'];  // ICD & SNOMED

            const hasDiabetes = conditions.some(c =>
              c.code?.coding?.some(code =>
                diabetesCodes.includes(code.code)
              )
            );

            p.diabetes = hasDiabetes ? "Yes" : "No";
            ret.resolve(p);
            });
          });
        } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);

    return ret.promise();

  };

  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      height: {value: ''},
      weight: {value: ''},
      bmi: {value: ''},
      bmi_1: {value: ''},
      age: {value: ''},
      glucose: {value: ''},
      smoke: {value: ''},
      gcs: {value: ''},
      cholesterol: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
      diabetes: {value: 'No'},
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }

  function getBMI(height, weight) {
    if (typeof height != 'undefined' && typeof weight != 'undefined') {
      const heightInMeters = parseFloat(height.split(' ')[0]) / 100;
      const weightInKg = parseFloat(weight.split(' ')[0]);
      return (weightInKg / (heightInMeters * heightInMeters)).toFixed(2) + ' kg/m²';
    } else {
      return undefined;
    }
  }

  function getSmokerStatus(smokingObservations) {
    const data = smokingObservations.sort((a, b) => Date.parse(b.issued) - Date.parse(a.issued));
    const currentSmokerSnomeds = ['449868002', '428041000124106', '428071000124103',
      '428061000124105', '77176002'];
    const notSmokerSnomeds = ['8517006', '266919005'];

    for (let i = 0; i < data.length; i++) {
      const ob = data[i];
      if (
        (ob.status.toLowerCase() === 'final' || ob.status.toLowerCase() === 'amended') &&
        ob.valueCodeableConcept &&
        ob.valueCodeableConcept.coding &&
        ob.valueCodeableConcept.coding[0].code
      ) {
        const code = ob.valueCodeableConcept.coding[0].code;
        if (currentSmokerSnomeds.includes(code)) {
          return 'Yes';
        } else if (notSmokerSnomeds.includes(code)) {
          return 'No';
        }
      }
    }
    return 'N/A';
  }


  window.drawVisualization = function(p) {
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#age').html(p.age);
    $('#height').html(p.height);
    $('#weight').html(p.weight);
    $('#bmi').html(p.bmi);
    $('#bmi_1').html(p.bmi_1);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
    $('#glucose').html(p.glucose);
    $('#cholesterol').html(p.cholesterol);
    $('#smoke').html(p.smoke);
    $('#gcs').html(p.gcs);
    $('#diabetes').html(p.diabetes);

  };

})(window);
