#!/usr/bin/env node
import {createTask,saveTask,loadTask,transition,updateTask} from './engine.mjs';
const [command,...args]=process.argv.slice(2);
try{
 if(command==='intent'){const task=createTask(args.join(' '));await saveTask(task);console.log(JSON.stringify({id:task.id,state:task.state,next:'Specify acceptance criteria and risks before execution'},null,2));}
 else if(command==='status'){const task=await loadTask(args[0]);console.log(JSON.stringify(task,null,2));}
 else if(command==='advance'){const [id,next,...rest]=args;const task=await loadTask(id);const updated=transition(task,next,{actor:process.env.ENCH_ACTOR||'system',evidence:rest.join(' ')||undefined});await updateTask(updated);console.log(JSON.stringify({id,state:updated.state},null,2));}
 else {console.log('Usage: npm run run -- intent "<product intent>" | status <id> | advance <id> <state> [evidence]');process.exitCode=1;}
}catch(e){console.error(e.message);process.exitCode=1;}
