/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";

import type { Env, Chat } from "./server";
import { getCurrentAgent } from "agents";
import { scheduleSchema } from "agents/schedule";

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 */
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  inputSchema: z.object({ city: z.string() }),
    execute: async ({ city }) => {
      console.log(`>>-- Getting weather for123 ${city} --<<`);
      return "It is very hot";
    }
  // Omitting execute function makes this tool require human confirmation
});

export const pingD1 = tool({
  description: "Simple D1 connectivity check (SELECT 1).",
  inputSchema: z.object({}),               // no args
  async execute(_args, { env: Env }) {
    if (!env?.cf_agent_d1) throw new Error("D1 binding 'cf_agent_d1' not found on env");
    const row = await env.cf_agent_d1.prepare("SELECT 1 AS ok;").first();
    console.log("D1 ping row:", row);
    return row;                            
  },
});


export const getLocalTime = tool<Env>({
  description: "get the local time for a specified location",
  inputSchema: z.object({ location: z.string() }),
  async execute({ location }, { env }) {          // ← env comes from the 2nd arg

    console.log(`1.getLocalTime123 for ${location} >> ${env} ---<<`);
    console.log(env)
    console.log(`2.getLocalTime123 for ${location} >> ${env} ---<<`);

    if (!env?.cf_agent_d1) throw new Error(`>>>D1 binding 'cf_agent_d1' not found on env -- ${env} <<`);

    // Simple D1 probe
    const nation = await env.cf_agent_d1.prepare("SELECT * FROM NATION LIMIT 4;").all();
    console.log("NATION sample:", nation);

    return "10am";
  },
});


const queryD1Database123 = tool({
  description: "Tool to query D1 SQL database and return data.",
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().optional()
  }),
  execute: async ({ query }, { env }) => {
    if (!env.cf_agent_d1) {
      throw new Error("D1 binding (env.cf_agent_d1) is missing. Check wrangler config and agent wiring.");
    }
    const res = await env.cf_agent_d1.prepare(query).all();
    return res.results ?? [];
  }
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  inputSchema: scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const { agent } = getCurrentAgent<Chat>();
    console.log(`>>-- Calling scheduleTask tool <<`);

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent!.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  }
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  }
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to cancel")
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<Chat>();
    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  }
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
  pingD1,
  queryD1Database123
} satisfies ToolSet;

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  }
};
