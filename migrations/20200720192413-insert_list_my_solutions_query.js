const Uuid = require('cassandra-driver').types.Uuid;
const config = require('../config/config');

module.exports = {
  async up(db) {
    global.migrationMsg = "Insert list my solutions query";
    
    
    if (!cassandra) {
      throw new Error("Cassandra connection not available.");
    }

    const query = 'SELECT id FROM ' + config.cassandra.keyspace + '.' + config.cassandra.table + ' WHERE qid = ? ALLOW FILTERING';
    const result = await cassandra.execute(query, ['list_my_solutions_query'], { prepare: true });
    const row = result.rows;

    if (!row.length) {

    let id = Uuid.random();

    let query = 'INSERT INTO ' + config.cassandra.keyspace + '.' + config.cassandra.table +' (id, qid, query) VALUES (?, ?, ?)';
   
    let queries = 
      [{
        query: query,
        params: [id.toString(), 'list_my_solutions_query', '{"queryType":"groupBy","dataSource":"sl_observation","granularity":"all","dimensions":["solutionId","solutionName","totalScore"],"filter":{"type":"and","fields":[{"type":"selector","dimension":"","value":""},{"type":"selector","dimension":"createdBy","value":""}]},"aggregations":[],"postAggregations":[],"intervals":["1901-01-01T00:00:00+00:00/2101-01-01T00:00:00+00:00"]}']
      }];

      await cassandra.batch(queries, { prepare: true });

      }
      
      return global.migrationMsg;
      },

      async down(db) {
        // return await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
      }
    };