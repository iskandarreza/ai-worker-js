import { Box, ListItem, Paper } from '@mui/material';

export function AgentResponsesList({ agentResponses }) {
  return (
    <Box>
      {agentResponses?.map((response, index) => {
        const key = `${response.id}--${response.cycle}`
        return (

          <Paper
            elevation={2}
            sx={{ display: 'flex', flexDirection: 'column', margin: '16px 0', padding: '16px' }}
            key={key}
          >
            <p><strong>MessageID:</strong> {key}</p>
            <p>
              <strong>Thoughts</strong>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {JSON.stringify(response.thoughts, null, 4)}
              </pre>
            </p>

            <p>
              <strong>Next Command</strong>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {JSON.stringify(response.command, null, 4)}
              </pre>
            </p>


          </Paper>
        )
      }
      )}
    </Box>
  );
}
