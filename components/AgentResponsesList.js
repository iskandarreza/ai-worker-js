import { Box, ListItem } from '@mui/material';

export function AgentResponsesList({ agentResponses }) {
  return (
    <Box>
      <h2>Agent Responses</h2>
      {agentResponses?.map((response, index) => (
        <ListItem key={`${index}`}>
          {JSON.stringify(response, null, 4)}
        </ListItem>
      ))}
    </Box>
  );
}
