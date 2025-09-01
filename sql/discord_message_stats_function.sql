-- Function to get Discord message statistics for growth tracking
-- This function aggregates message data from the existing Discord messages table

CREATE OR REPLACE FUNCTION get_discord_message_stats(
    p_guild_id TEXT DEFAULT NULL,
    p_days INTEGER DEFAULT 1
)
RETURNS TABLE (
    total_messages BIGINT,
    unique_users BIGINT,
    channels_with_activity BIGINT,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_messages,
        COUNT(DISTINCT user_id)::BIGINT as unique_users,
        COUNT(DISTINCT channel_id)::BIGINT as channels_with_activity,
        (NOW() - INTERVAL '1 day' * p_days)::TIMESTAMP WITH TIME ZONE as period_start,
        NOW()::TIMESTAMP WITH TIME ZONE as period_end
    FROM discord_messages 
    WHERE 
        -- Filter by guild if provided
        (p_guild_id IS NULL OR guild_id = p_guild_id)
        -- Filter by time period
        AND timestamp >= (NOW() - INTERVAL '1 day' * p_days);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_discord_message_stats TO authenticated, anon;

-- Test the function
SELECT * FROM get_discord_message_stats('1019977148875944016', 1);
SELECT * FROM get_discord_message_stats('1019977148875944016', 7);
SELECT * FROM get_discord_message_stats('1019977148875944016', 30);