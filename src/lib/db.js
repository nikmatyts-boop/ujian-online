import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Helper to convert camelCase to snake_case
const toSnakeCase = str => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

// Helper to convert snake_case to camelCase
const toCamelCase = str => str.replace(/_([a-z])/g, (g, letter) => letter.toUpperCase());

const convertKeys = (obj, converter) => {
  if (Array.isArray(obj)) {
    return obj.map(v => convertKeys(v, converter));
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      result[converter(key)] = convertKeys(obj[key], converter);
      return result;
    }, {});
  }
  return obj;
};

// Map JS table names to SQL table names
const tableMap = {
  sessions: 'exam_sessions',
  loginLogs: 'login_logs',
  classes: 'classes',
  users: 'users',
  subjects: 'subjects',
  exams: 'exams',
  exitRequests: 'exit_requests'
};

export const db = {
  get: async (table) => {
    if (!supabase) return [];
    const sqlTable = tableMap[table] || table;
    const { data, error } = await supabase.from(sqlTable).select('*');
    if (error) {
      console.error(`Error fetching ${table}:`, error);
      return [];
    }
    return convertKeys(data, toCamelCase);
  },
  
  save: async (table, data) => {
    if (!supabase) return;
    const sqlTable = tableMap[table] || table;
    const snakeData = convertKeys(data, toSnakeCase);
    
    // Upsert new/updated data (works for both object and array)
    const { error } = await supabase.from(sqlTable).upsert(snakeData);
    if (error) {
      console.error(`Error saving ${table}:`, error);
    }
  },

  delete: async (table, idCol, idVal) => {
    if (!supabase) return;
    const sqlTable = tableMap[table] || table;
    const snakeCol = toSnakeCase(idCol);
    const { error } = await supabase.from(sqlTable).delete().match({ [snakeCol]: idVal });
    if (error) {
      console.error(`Error deleting from ${table}:`, error);
    }
  },
  
  notify: (type, payload) => {
    if (!supabase) return;
    supabase.channel('exam-events').send({
      type: 'broadcast',
      event: type,
      payload: payload
    });
  },
  
  subscribe: (callback) => {
    if (!supabase) return () => {};
    const channel = supabase.channel('exam-events')
      .on('broadcast', { event: '*' }, (payload) => {
        callback({ type: payload.event, payload: payload.payload });
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }
};

export const initDb = async () => {};
