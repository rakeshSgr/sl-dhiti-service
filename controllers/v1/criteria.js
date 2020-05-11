const config = require('../../config/config');
const rp = require('request-promise');
const request = require('request');
const model = require('../../db');
const helperFunc = require('../../helper/chart_data');
const pdfHandler = require('../../helper/common_handler');
const omit = require('object.omit');
const url = require("url");
const authService = require('../../middleware/authentication_service');
const rimraf = require("rimraf");
const fs = require('fs');
const path = require('path');


/**
   * @api {post} /dhiti/api/v1/criteria/instanceReport 
   * Instance report
   * @apiVersion 1.0.0
   * @apiGroup Criteria
   * @apiHeader {String} x-auth-token Authenticity token  
   * @apiParamExample {json} Request-Body:
* {
  "submissionId": "",
* }
   * @apiSuccessExample {json} Success-Response:
*     HTTP/1.1 200 OK
*     {
       "entityName": "",
       "observationName": "",
       "observationId": "",
       "entityType": "",
       "entityId": "",
       "response": [{
         "order": "",
         "question": "",
         "responseType": "",
         "answers": [],
         "chart": {},
         "instanceQuestions":[],
         "evidences":[
              {url:"", extension:""},
            ]
       }]
*     }
   * @apiUse errorBody
   */

//Controller for instance observation report
exports.instanceReport = async function (req, res) {

    let data = await instanceObservationData(req, res);

    res.send(data);
}


async function instanceObservationData(req, res) {

    return new Promise(async function (resolve, reject) {

        if (!req.body.submissionId) {
            let response = {
                result: false,
                message: 'submissionId is a required field'
            };
            resolve(response);
        } else {

            let submissionId = req.body.submissionId;

            model.MyModel.findOneAsync({ qid: "instance_observation_query" }, { allow_filtering: true })
                .then(async function (result) {

                    let bodyParam = JSON.parse(result.query);

                    if (config.druid.observation_datasource_name) {
                        bodyParam.dataSource = config.druid.observation_datasource_name;
                    }

                    bodyParam.dimensions.push("criteriaName", "criteriaId","instanceParentCriteriaName","instanceParentCriteriaId");

                    //if filter is given
                    if (req.body.filter) {
                        if (req.body.filter.criteriaId && req.body.filter.criteriaId.length > 0) {
                            let filter = {};
                            filter = { "type": "and", "fields": [{ "type": "selector", "dimension": "observationSubmissionId", "value": submissionId }, { "type": "in", "dimension":"criteriaId","values":req.body.filter.criteriaId }] };
                            bodyParam.filter = filter;
                        }
                        else {
                            bodyParam.filter.value = submissionId;
                        }
                    }
                    else {
                        bodyParam.filter.value = submissionId;
                    }

                    //pass the query as body param and get the resul from druid
                    let options = config.druid.options;
                    options.method = "POST";
                    options.body = bodyParam;
                    let data = await rp(options);

                    if (!data.length) {
                        resolve({
                            "result": false,
                            "data": "SUBMISSION_ID_NOT_FOUND"
                        });
                    } else {

                        let reportType = "criteria";
                        let chartData = await helperFunc.instanceReportChart(data, reportType);

                        //Get evidence data from evidence datasource
                        let inputObj = {
                            submissionId: submissionId
                        }

                        let evidenceData = await getEvidenceData(inputObj);
                        let responseObj;

                        if (evidenceData.result) {
                            responseObj = await helperFunc.evidenceChartObjectCreation(chartData, evidenceData.data, req.headers["x-auth-token"]);
                        } else {
                            responseObj = chartData;
                        }

                        responseObj = await helperFunc.getCriteriawiseReport(responseObj);

                        resolve(responseObj);

                    }
                })
                .catch(function (err) {
                    let response = {
                        result: false,
                        message: 'INTERNAL_SERVER_ERROR'
                    };
                    resolve(response);
                });
        }
    });
};




//<======================== Instance observation score report ========================================>


/**
   * @api {post} /dhiti/api/v1/criteria/instanceScoreReport 
   * Instance score report
   * @apiVersion 1.0.0
   * @apiGroup Criteria
   * @apiHeader {String} x-auth-token Authenticity token  
   * @apiParamExample {json} Request-Body:
* {
  "submissionId": "",
* }
   * @apiSuccessExample {json} Success-Response:
*     HTTP/1.1 200 OK
*     {
       "result": true,
       "totalScore": "",
       "scoreAchieved": "",
       "observationName": "",
       "response": [{
          "order": "",
          "question": "",
          "chart": {
            "type": "",
            "credits": {
                "enabled": false
            },
            "plotOptions": {
                "pie": {
                    "allowPointSelect": true,
                    "cursor": "pointer",
                    "dataLabels": {
                        "enabled": false
                    },
                    "showInLegend": true,
                    "borderColor": "#000000"
                }
            },
            "data": [{
                "data": [{
                    "name": "",
                    "y": "",
                    "color": "#6c4fa1"
                },{
                    "name": "",
                    "y": "",
                    "color": "#fff"
                  }
                }
            ]
          }
        },
        "evidences":[
              {url:"", extension:""},
          ]
      ]
*     }
   * @apiUse errorBody
   */

//Controller for instance observation score report query
exports.instanceScoreReport = async function (req, res) {

    let data = await instanceScoreReportData(req, res);
  
    res.send(data);
  }
  
  
  //Controller for instance observation score report chart object creation
  async function instanceScoreReportData(req, res) {
  
    return new Promise(async function (resolve, reject) {
  
      if (!req.body.submissionId) {
        let response = {
          result: false,
          message: 'submissionId is a required field'
        };
  
        resolve(response);
  
      } else {
  
        model.MyModel.findOneAsync({ qid: "instance_observation_score_query" }, { allow_filtering: true })
          .then(async function (result) {
  
            let bodyParam = JSON.parse(result.query);
  
            if (config.druid.observation_datasource_name) {
              bodyParam.dataSource = config.druid.observation_datasource_name;
            }
           
            bodyParam.dimensions.push("criteriaName", "criteriaId");

             //if filter is given
             if (req.body.filter) {
              if (req.body.filter.criteriaId && req.body.filter.criteriaId.length > 0) {
                bodyParam.filter.fields[0].value = req.body.submissionId;
                bodyParam.filter.fields.push({"type":"in","dimension":"criteriaId","values":req.body.filter.criteriaId});
              }
              else {
                bodyParam.filter.fields[0].value = req.body.submissionId;
              }
            }
            else {
              bodyParam.filter.fields[0].value = req.body.submissionId;
            }
        
            //pass the query as body param and get the resul from druid
            let options = config.druid.options;
            options.method = "POST";
            options.body = bodyParam;
            let data = await rp(options);
  
            if (!data.length) {
              resolve({
                "result": false,
                "data": "SUBMISSION_ID_NOT_FOUND"
              });
            } else {
                
              let reportType = "criteria";
              let chartData = await helperFunc.instanceScoreReportChartObjectCreation(data,reportType);

              //Get evidence data from evidence datasource
              let inputObj = {
                submissionId : req.body.submissionId
              }

              let evidenceData = await getEvidenceData(inputObj);
              
              let responseObj;

              if(evidenceData.result) {
                responseObj = await helperFunc.evidenceChartObjectCreation(chartData,evidenceData.data,req.headers["x-auth-token"]);

              } else {
                responseObj = chartData;
              }

              responseObj = await helperFunc.getCriteriawiseReport(responseObj);

              resolve(responseObj);
            }
          })
          .catch(function (err) {
            console.log(err);
            let response = {
              result: false,
              message: 'INTERNAL_SERVER_ERROR'
            };
            resolve(response);
          });
  
      }
    })
  };




/**
   * @api {post} /dhiti/api/v1/criteria/entityReport
   * Entity report
   * @apiVersion 1.0.0
   * @apiGroup Criteria
   * @apiHeader {String} x-auth-token Authenticity token    
   * @apiParamExample {json} Request-Body:
* {
  "entityId": "",
  "observationId": "",
* }
   * @apiSuccessExample {json} Success-Response:
*     HTTP/1.1 200 OK
*     {
       "observationId": "",
       "observationName": "",
       "entityType": "",
       "entityId": "",
       "entityName": "",
       "response": [{
          "order": "",
          "question": "",
          "responseType": "",
          "answers": "",
          "chart": {},
          "instanceQuestions": [],
          "evidences":[
              {url:"", extension:""}
          ]
       }]
*     }
   * @apiUse errorBody
   */

//Controller for entity observation report
exports.entityReport = async function (req, res) {

  let data = await entityReportData(req, res);

  res.send(data);
}


async function entityReportData(req, res) {

  return new Promise(async function (resolve, reject) {

    if (!req.body.entityId && !req.body.observationId) {
      let response = {
        result: false,
        message: 'entityId and observationId are required fields'
      }
      resolve(response);
    }
    else {

      model.MyModel.findOneAsync({ qid: "entity_observation_query" }, { allow_filtering: true })
        .then(async function (result) {

          let bodyParam = JSON.parse(result.query);

          if (config.druid.observation_datasource_name) {
            bodyParam.dataSource = config.druid.observation_datasource_name;
          }

          let entityType = "school";
          
          if(req.body.entityType){
            entityType = req.body.entityType;
          }

          bodyParam.dimensions.push("criteriaName", "criteriaId","instanceParentCriteriaName","instanceParentCriteriaId");

           //if filter is given
           if (req.body.filter) {
            if (req.body.filter.criteriaId && req.body.filter.criteriaId.length > 0) {
              let filter = { "type": "and", "fields": [{"type":"and","fields":[{"type": "selector", "dimension": entityType, "value": req.body.entityId },{"type": "selector", "dimension": "observationId", "value": req.body.observationId }]}, { "type": "in", "dimension":"criteriaId","values":req.body.filter.criteriaId }] };
              bodyParam.filter = filter;
              
            }
            else {
              bodyParam.filter.fields[0].dimension = entityType;
              bodyParam.filter.fields[0].value = req.body.entityId;
              bodyParam.filter.fields[1].value = req.body.observationId;
            }
          }
          else {
            bodyParam.filter.fields[0].dimension = entityType;
            bodyParam.filter.fields[0].value = req.body.entityId;
            bodyParam.filter.fields[1].value = req.body.observationId;
          }

          //pass the query as body param and get the resul from druid
          var options = config.druid.options;
          options.method = "POST";
          options.body = bodyParam;
          var data = await rp(options);

          if (!data.length) {
            resolve({ 
              "result": false,
              "data": "NO_OBSERVATIONS_MADE_FOR_THE_ENTITY" })
          }
          else {

            let reportType = "criteria";
            let chartData = await helperFunc.entityReportChart(data, req.body.entityId, "school",reportType)

             //Get evidence data from evidence datasource
             let inputObj = {
              entityId : req.body.entityId,
              observationId : req.body.observationId
            }

            let evidenceData = await getEvidenceData(inputObj);
            
            let responseObj;

            if(evidenceData.result) {
              responseObj = await helperFunc.evidenceChartObjectCreation(chartData,evidenceData.data,req.headers["x-auth-token"]);

            } else {
              responseObj = chartData;
            }
          
            responseObj = await helperFunc.getCriteriawiseReport(responseObj);

            resolve(responseObj);

          }
        })
        .catch(function (err) {
          res.status(400);
          var response = {
            result: false,
            message: 'INTERNAL_SERVER_ERROR'
          }
          resolve(response);
        })
    }
  });
}



/**
   * @api {post} /dhiti/api/v1/observations/entityScoreReport 
   * Entity score report
   * @apiVersion 1.0.0
   * @apiGroup Observations
   * @apiHeader {String} x-auth-token Authenticity token  
   * @apiParamExample {json} Request-Body:
* {
  "entityId": "",
  "observationId": ""
* }
   * @apiSuccessExample {json} Success-Response:
*     HTTP/1.1 200 OK
*     {
       "result": true,
       "schoolName": "",
       "totalObservations": "",
       "observationName": "",
       "response" : [{
          "order": "",
          "question": "",
          "chart": {
            "type": "scatter",
            "title": "",
            "xAxis": {
                "title": {
                    "enabled": true,
                    "text": "observations"
                },
                "labels: {},
                "categories": ["Obs1", "Obs2", "Obs3", "Obs4", "Obs5"],
                "startOnTick": false,
                "endOnTick": false,
                "showLastLabel": true
            },
            "yAxis": {
                "min": 0,
                "max": "",
                "allowDecimals": false,
                "title": {
                    "text": "Score"
                }
            },
            "plotOptions":{
                "scatter":{
                    "lineWidth": 1,
                    "lineColor": "#F6B343"
                }
            },
            "credits": {
                "enabled": false
            },
            "legend": {
                "enabled": false
            },
            "data": [{
                "color": "#F6B343",
                "data": []
            }]

          }
        }]
*     }
   * @apiUse errorBody
   */

//Controller for Entity Observation Score Report
exports.entityScoreReport = async function (req, res) {

  let data = await entityScoreReportData(req, res);

  res.send(data);

}

async function entityScoreReportData(req, res) {
  
  return new Promise(async function (resolve, reject) {

    if (!req.body.entityId && !req.body.observationId) {
      var response = {
        result: false,
        message: 'entityId and observationId are required fields'
      }
      resolve(response);
    }

    else {

      model.MyModel.findOneAsync({ qid: "entity_observation_score_query" }, { allow_filtering: true })
        .then(async function (result) {

          var bodyParam = JSON.parse(result.query);

          if (config.druid.observation_datasource_name) {
            bodyParam.dataSource = config.druid.observation_datasource_name;
          }

          bodyParam.dimensions.push("criteriaName","criteriaId");

          let entityType = "school";

          if(req.body.entityType){
            entityType = req.body.entityType;
          }

           //if filter is given
           if (req.body.filter) {
            if (req.body.filter.criteriaId && req.body.filter.criteriaId.length > 0) {
              bodyParam.filter.fields[1].fields[0].dimension = entityType;
              bodyParam.filter.fields[1].fields[0].value = req.body.entityId;
              bodyParam.filter.fields[1].fields[1].value = req.body.observationId;
              bodyParam.filter.fields.push({"type":"in","dimension":"criteriaId","values":req.body.filter.criteriaId});
            }
            else {
              bodyParam.filter.fields[1].fields[0].dimension = entityType;
              bodyParam.filter.fields[1].fields[0].value = req.body.entityId;
              bodyParam.filter.fields[1].fields[1].value = req.body.observationId;
            }
          }
          else {
            bodyParam.filter.fields[1].fields[0].dimension = entityType;
            bodyParam.filter.fields[1].fields[0].value = req.body.entityId;
            bodyParam.filter.fields[1].fields[1].value = req.body.observationId;
          }


          //pass the query as body param and get the resul from druid
          var options = config.druid.options;
          options.method = "POST";
          options.body = bodyParam;

          var data = await rp(options);

          if (!data.length) {
            resolve({
              "result": false,
              "data": "NO_OBSERVATIONS_MADE_FOR_THE_ENTITY" })
          }

          else {
            let reportType = "criteria";
            let chartData = await helperFunc.entityScoreReportChartObjectCreation(data,"v2", reportType);

            //Get evidence data from evidence datasource
             let inputObj = {
              entityId : req.body.entityId,
              observationId: req.body.observationId
            }

            let evidenceData = await getEvidenceData(inputObj);
            let responseObj;

            if(evidenceData.result) {
                responseObj = await helperFunc.evidenceChartObjectCreation(chartData,evidenceData.data,req.headers["x-auth-token"]);
            } else {
                responseObj = chartData;
            }

            responseObj = await helperFunc.getCriteriawiseReport(responseObj);
            resolve(responseObj);

          }
        })

        .catch(function (err) {
          console.log(err);
          let response = {
            result: false,
            message: 'INTERNAL_SERVER_ERROR'
          }
          resolve(response);
        })

    }

  })

}

// ============================ Observation report API's =============================>

/**
   * @api {post} /dhiti/api/v1/observations/report
   * Observation report
   * @apiVersion 1.0.0
   * @apiGroup Observations
   * @apiHeader {String} x-auth-token Authenticity token  
   * @apiParamExample {json} Request-Body:
* {
  "observationId": "",
* }
   * @apiSuccessExample {json} Success-Response:
*     HTTP/1.1 200 OK
*     {
       "observationId": "",
       "observationName": "",
       "entityType": "",
       "entityId": "",
       "entityName": "",
       "response": [{
          "order": "",
          "question": "",
          "responseType": "",
          "answers": "",
          "chart": {},
          "instanceQuestions": [],
          "evidences":[
              {url:"", extension:""},
          ]
       }]
*     }
   * @apiUse successBody
   * @apiUse errorBody
   */

//Controller for observation report
exports.observationReport = async function (req, res) {
  return new Promise(async function (resolve, reject) {
      let data = await observationReportData(req, res);
      res.send(data);
  })
}

async function observationReportData(req, res) {
  return new Promise(async function (resolve, reject) {

      if (!req.body.observationId) {
          let response = {
              result: false,
              message: 'observationId is a required field'
          }
          resolve(response);
      }
      else {
          
          model.MyModel.findOneAsync({ qid: "observation_report_query" }, { allow_filtering: true })
              .then(async function (result) {

                var bodyParam = JSON.parse(result.query);
                if (config.druid.observation_datasource_name) {
                  bodyParam.dataSource = config.druid.observation_datasource_name;
                }
                 
                bodyParam.dimensions.push("criteriaName", "criteriaId","instanceParentCriteriaName","instanceParentCriteriaId");

                //if filter is given
                if (req.body.filter) {
                  if (req.body.filter.criteriaId && req.body.filter.criteriaId.length > 0) {
                    let filter = { "type": "and", "fields": [{ "type": "selector", "dimension": "observationId", "value": req.body.observationId }, { "type": "in", "dimension": "criteriaId", "values": req.body.filter.criteriaId }] };
                    bodyParam.filter = filter;

                  }
                  else {
                    bodyParam.filter.value = req.body.observationId;
                  }
                }
                else {
                  bodyParam.filter.value = req.body.observationId;
                }

                //pass the query as body param and get the resul from druid
                var options = config.druid.options;
                options.method = "POST";
                options.body = bodyParam;
                var data = await rp(options);

                  //if no data throw error message
                  if (!data.length) {
                      resolve({
                        "result": false,
                         "data": "NO_ENTITY_WAS_FOUND" })
                  }
                else {
                  let entityId = "";
                  let entityType = "";
                  let reportType = "criteria";
                  let chartData = await helperFunc.entityReportChart(data, entityId, entityType, reportType);

                  //Get evidence data from evidence datasource
                  let inputObj = {
                    observationId: req.body.observationId
                  }

                  let evidenceData = await getEvidenceData(inputObj);

                  let responseObj;

                  if (evidenceData.result) {
                    responseObj = await helperFunc.evidenceChartObjectCreation(chartData, evidenceData.data, req.headers["x-auth-token"]);

                  } else {
                    responseObj = chartData;
                  }
                  
                  responseObj = await helperFunc.getCriteriawiseReport(responseObj);
                  resolve(responseObj);

                }
              })
            .catch(function (err) {
                  let response = {
                      result: false,
                      message: 'INTERNAL_SERVER_ERROR'
                  }
                  resolve(response);
              })
      }
  });
}



//<======================== Observation score report ========================================>

/**
   * @api {post} /dhiti/api/v1/observations/scoreReport
   * Observation score report
   * @apiVersion 1.0.0
   * @apiGroup Observations
   * @apiHeader {String} x-auth-token Authenticity token  
   * @apiParamExample {json} Request-Body:
* {
  "observationId": "",
* }
   * @apiSuccessExample {json} Success-Response:
*     HTTP/1.1 200 OK
*     {
       "result": true,
       "solutionName": "",
       "response": [{
         "order": "",
         "question": "",
         "chart": {
            "type": "bar",
            "title": "",
            "xAxis": {
                "title": {
                    "text": null
                },
                "labels": {},
                "categories": []
            },
            "yAxis": {
                "min": 0,
                "max": "",
                "title": {
                    "text": "Score"
                },
                "labels": {
                    "overflow": "justify"
                },
                "allowDecimals" : false
            },
            "plotOptions": {
                "bar": {
                    "dataLabels": {
                        "enabled": true
                    }
                }
            },
            "legend": {
               "enabled" : true
            },
            "credits": {
                "enabled": false
            },
            "data": [{
                "name": "observation1",
                "data": []
            }, {
                "name": "observation2",
                "data": []
            }]

          }
        },
        "evidences":[
            {url:"", extension:""},
        ]
      ]
*     }
   * @apiUse errorBody
   */

//Controller for observation Score report  
exports.observationScoreReport = async function (req , res){

  let data = await observationScoreReportData(req, res);

  res.send(data);

}


async function observationScoreReportData(req, res) {

  return new Promise(async function (resolve, reject) {

    if (!req.body.observationId) {
      let response = {
        result: false,
        message: 'observationId is a required fields'
      }
      resolve(response);
    }

    else {

      model.MyModel.findOneAsync({ qid: "observation_score_report_query" }, { allow_filtering: true })
        .then(async function (result) {

          var bodyParam = JSON.parse(result.query);

          if (config.druid.observation_datasource_name) {
            bodyParam.dataSource = config.druid.observation_datasource_name;
          }
          
          bodyParam.dimensions.push("criteriaName", "criteriaId");

           //if filter is given
           if (req.body.filter) {
            if (req.body.filter.criteriaId && req.body.filter.criteriaId.length > 0) {
              bodyParam.filter.fields[0].value = req.body.observationId;
              bodyParam.filter.fields.push({"type":"in","dimension":"criteriaId","values":req.body.filter.criteriaId});
            }
            else {
              bodyParam.filter.fields[0].value = req.body.observationId;
            }
          }
          else {
            bodyParam.filter.fields[0].value = req.body.observationId;
          }

          //pass the query as body param and get the resul from druid
          var options = config.druid.options;
          options.method = "POST";
          options.body = bodyParam;

          var data = await rp(options);

          if (!data.length) {
            resolve({
               "result": false, 
               "data": "NO_ENTITIES_FOUND" })
          }

          else {
            let reportType = "criteria";
            let chartData = await helperFunc.observationScoreReportChart(data,reportType);

              //Call samiksha API to get total schools count for the given observationId
              let totalSchools = await getTotalSchools(req.body.observationId,req.headers["x-auth-token"]);

            if (totalSchools.result) {
              chartData.totalSchools = totalSchools.result.count;
            }

            //Get evidence data from evidence datasource
            let inputObj = {
              observationId: req.body.observationId
            }

            let evidenceData = await getEvidenceData(inputObj);

            let responseObj;

            if (evidenceData.result) {
              responseObj = await helperFunc.evidenceChartObjectCreation(chartData, evidenceData.data, req.headers["x-auth-token"]);

            } else {
              responseObj = chartData;
            }

            responseObj = await helperFunc.getCriteriawiseReport(responseObj);
            resolve(responseObj);

          }
        })

        .catch(function (err) {
          var response = {
            result: false,
            message: 'INTERNAL_SERVER_ERROR'
          }
          resolve(response);
        })

    }

  })

}


// Get the evidence data
async function getEvidenceData(inputObj) {

  return new Promise(async function (resolve, reject) {

      model.MyModel.findOneAsync({ qid: "get_evidence_query" }, { allow_filtering: true })
          .then(async function (result) {

              let submissionId = inputObj.submissionId;
              let entityId = inputObj.entityId;
              let observationId = inputObj.observationId;

              var bodyParam = JSON.parse(result.query);

              //based on the given input change the filter
              let filter = {};

              if (submissionId) {
                  filter = { "type": "selector", "dimension": "observationSubmissionId", "value": submissionId }
              } else if (entityId && observationId) {
                  filter = { "type": "and", "fields": [{ "type": "selector", "dimension": "school", "value": entityId }, { "type": "selector", "dimension": "observationId", "value": observationId }] }
              } else if (observationId) {
                  filter = { "type": "selector", "dimension": "observationId", "value": observationId }
              }

              if (config.druid.evidence_datasource_name) {
                  bodyParam.dataSource = config.druid.evidence_datasource_name;
              }

              bodyParam.filter = filter;

              //pass the query as body param and get the resul from druid
              var options = config.druid.options;
              options.method = "POST";
              options.body = bodyParam;
              var data = await rp(options);

              if (!data.length) {
                  resolve({
                      "result": false,
                      "data": "EVIDENCE_NOT_FOUND"
                  });
              } else {
                  resolve({ "result": true, "data": data });
              }
          })
          .catch(function (err) {
              var response = {
                  result: false,
                  message: "INTERNAL_SERVER_ERROR"
              };
              resolve(response);
          });
  })
}


//Function to make a call to samiksha assessment entities list API
async function getTotalSchools(observationId,token) {

  return new Promise(async function(resolve){
  var options = {
    method: "GET",
    json: true,
    headers: {
        "Content-Type": "application/json",
        "X-authenticated-user-token": token
    },
    uri: config.samiksha_api.observation_details_api + observationId
}

  rp(options).then(function(resp){
    return resolve(resp);

  }).catch(function(err){
    return resolve(err);
  })

});
}