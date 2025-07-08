import sgfmill.sgf
import sgfmill.boards
from logging import getLogger
from typing import List, Tuple, Set, Optional, Dict, Literal, FrozenSet # Import FrozenSet
import math 

# --- Type Aliases for Clarity ---
# sgfmill.boards.Board.get() returns 'b', 'w', or None.
StoneColorSGF = Literal['b', 'w', None] 
# The board_before_move_list uses 'B', 'W', 'E'.
StoneColorList = Literal['B', 'W', 'E']
# A board state represented as a list of lists (for JSON serialization)
BoardStateList = List[List[StoneColorList]] 
# A group of stones (set of (row, col) tuples). This is a mutable set.
StoneGroup = Set[Tuple[int, int]]
# An immutable stone group, suitable for adding to other sets.
FrozenStoneGroup = FrozenSet[Tuple[int, int]]

# --- Constants for Stone Colors (aligned with sgfmill and list representation) ---
SGF_BLACK: Literal['b'] = 'b'
SGF_WHITE: Literal['w'] = 'w'
SGF_EMPTY: None = None # Represents empty intersection in sgfmill.boards.Board

LIST_BLACK: Literal['B'] = 'B' # For the list[list[str]] board representation
LIST_WHITE: Literal['W'] = 'W' # For the list[list[str]] board representation
LIST_EMPTY: Literal['E'] = 'E' # For the list[list[str]] board representation


class GameAnalyzer:
    def __init__(self, board_size: int = 19):
        """
        Initializes the GameAnalyzer.

        Args:
            board_size (int): The size of the square Go board (e.g., 9, 13, 19).
        """
        self.board_size: int = board_size
        self.analysis_log: List[Dict] = []
        self.log = getLogger("Analyzer")
        self.log.info(f"GameAnalyzer initialized for a {board_size}x{board_size} board.")

    def _coords_to_sgf_string(self, r: int, c: int) -> str:
        """
        Converts 0-indexed (row, col) to SGF string coordinates (e.g., (0,0) -> 'aa').

        Args:
            r (int): 0-indexed row.
            c (int): 0-indexed column.

        Returns:
            str: The SGF coordinate string.
        """
        return chr(ord('a') + c) + chr(ord('a') + r)

    def _get_opposite_color_sgf(self, color: StoneColorSGF) -> StoneColorSGF:
        """
        Returns the opposite SGF stone color ('b' for 'w', 'w' for 'b').

        Args:
            color (StoneColorSGF): The SGF stone color ('b' or 'w').

        Returns:
            StoneColorSGF: The opposite SGF stone color.
        """
        if color == SGF_BLACK:
            return SGF_WHITE
        elif color == SGF_WHITE:
            return SGF_BLACK
        return SGF_EMPTY # Should not happen for player colors

    def _is_on_board(self, r: int, c: int) -> bool:
        """
        Checks if given coordinates (row, col) are within the board boundaries.

        Args:
            r (int): Row index.
            c (int): Column index.

        Returns:
            bool: True if coordinates are on the board, False otherwise.
        """
        return 0 <= r < self.board_size and 0 <= c < self.board_size

    def _neighbors(self, r: int, c: int) -> List[Tuple[int, int]]:
        """
        Returns the list of valid orthogonal neighbor coordinates for a given point.

        Args:
            r (int): Row index of the point.
            c (int): Column index of the point.

        Returns:
            list[tuple[int, int]]: A list of (row, col) tuples for valid orthogonal neighbors.
        """
        neighbors_list: List[Tuple[int, int]] = []
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]: # Up, Down, Left, Right
            nr, nc = r + dr, c + dc
            if self._is_on_board(nr, nc):
                neighbors_list.append((nr, nc))
        return neighbors_list

    def _get_group(self, board: sgfmill.boards.Board, pos: Tuple[int, int]) -> StoneGroup:
        """
        Finds all stones in the group connected to pos (connected component).

        Args:
            board (sgfmill.boards.Board): The current board state.
            pos (tuple[int, int]): The (row, col) of a stone within the group.

        Returns:
            set[tuple[int, int]]: A set of (row, col) tuples representing all stones in the group.
        """
        color: StoneColorSGF = board.get(*pos)
        if color is None: # Not a stone
            return set()

        visited: StoneGroup = set()
        stack: List[Tuple[int, int]] = [pos]

        while stack:
            r, c = stack.pop()
            if (r, c) in visited:
                continue
            
            if board.get(r, c) == color:
                visited.add((r, c))
                for nr, nc in self._neighbors(r, c):
                    if (nr, nc) not in visited:
                        stack.append((nr, nc))
        return visited

    def _get_liberties(self, board: sgfmill.boards.Board, group: StoneGroup) -> Set[Tuple[int, int]]:
        """
        Returns the set of liberties (empty adjacent points) for a given group of stones.

        Args:
            board (sgfmill.boards.Board): The current board state.
            group (set[tuple[int, int]]): A set of (row, col) tuples representing the stones in the group.

        Returns:
            set[tuple[int, int]]: A set of (row, col) tuples representing the liberties.
        """
        liberties: Set[Tuple[int, int]] = set()
        for r, c in group:
            for nr, nc in self._neighbors(r, c):
                if board.get(nr, nc) is None: # If the neighbor is empty, it's a liberty
                    liberties.add((nr, nc))
        return liberties

    def _board_to_list(self, board_obj: sgfmill.boards.Board) -> BoardStateList:
        """
        Converts an sgfmill board object to a list of lists for JSON serialization.
        Uses 'B' for black, 'W' for white, 'E' for empty.

        Args:
            board_obj (sgfmill.boards.Board): The sgfmill board object.

        Returns:
            list[list[str]]: A 2D list representation of the board.
        """
        board_list: BoardStateList = []
        for r in range(board_obj.side):
            row_list: List[StoneColorList] = []
            for c in range(board_obj.side):
                stone: StoneColorSGF = board_obj.get(r, c)
                if stone == SGF_BLACK:
                    row_list.append(LIST_BLACK)
                elif stone == SGF_WHITE:
                    row_list.append(LIST_WHITE)
                else: # SGF_EMPTY (None)
                    row_list.append(LIST_EMPTY)
            board_list.append(row_list)
        return board_list
    
    def _is_contact_play(self, board: sgfmill.boards.Board, row: int, col: int, player_color: StoneColorSGF) -> bool:
        """
        Checks if the new stone is adjacent (orthogonally) to any opponent stone.
        """
        opponent_color: StoneColorSGF = self._get_opposite_color_sgf(player_color)
        return any(board.get(nr, nc) == opponent_color for nr, nc in self._neighbors(row, col))

    def _calculate_distance_from_center(self, r: int, c: int) -> float:
        """
        Calculates the Euclidean distance of a point from the board center.
        """
        center_coord = (self.board_size - 1) / 2.0
        return math.sqrt((r - center_coord)**2 + (c - center_coord)**2)

    def _calculate_distance_to_nearest_friendly_stone(self, board: sgfmill.boards.Board, 
                                                       move_row: int, move_col: int, 
                                                       player_color: StoneColorSGF) -> Optional[float]:
        """
        Calculates the Euclidean distance to the nearest *other* friendly stone.
        Returns None if no other friendly stones exist (e.g., first stone placed).
        """
        min_dist: Optional[float] = None
        
        for r_other in range(self.board_size):
            for c_other in range(self.board_size):
                # Skip the stone just placed
                if (r_other, c_other) == (move_row, move_col):
                    continue 
                
                if board.get(r_other, c_other) == player_color:
                    dist = math.sqrt((move_row - r_other)**2 + (move_col - c_other)**2)
                    if min_dist is None or dist < min_dist:
                        min_dist = dist
        return min_dist

    def _check_self_atari(self, board: sgfmill.boards.Board, row: int, col: int) -> bool:
        """
        Checks if the newly placed stone is in self-atari.
        """
        group: StoneGroup = self._get_group(board, (row, col))
        liberties: Set[Tuple[int, int]] = self._get_liberties(board, group)
        return len(liberties) == 1

    def _check_atari_threats(self, board: sgfmill.boards.Board, row: int, col: int, player_color: StoneColorSGF) -> Tuple[List[Tuple], List[Tuple]]:
        """
        Checks for opponent groups now in atari or threatening atari (2 liberties).
        Returns lists of unique, sorted group tuples.
        """
        opponent_color: StoneColorSGF = self._get_opposite_color_sgf(player_color)
        atari_groups: List[Tuple] = []
        atari_threat_groups: List[Tuple] = []
        
        # Use FrozenStoneGroup for checked_groups to ensure hashability
        checked_groups: Set[FrozenStoneGroup] = set() 

        for nr, nc in self._neighbors(row, col):
            if board.get(nr, nc) == opponent_color:
                opp_group: StoneGroup = self._get_group(board, (nr, nc))
                # Convert the mutable set to a frozenset for hashing
                frozen_opp_group: FrozenStoneGroup = frozenset(opp_group)
                
                # Check if this group has already been processed
                if frozen_opp_group in checked_groups:
                    continue
                checked_groups.add(frozen_opp_group)

                liberties: Set[Tuple[int, int]] = self._get_liberties(board, opp_group)
                num_liberties: int = len(liberties)
                
                # Convert set of tuples to sorted tuple of tuples for consistent reporting
                reportable_group: Tuple = tuple(sorted(list(opp_group)))

                if num_liberties == 1:
                    atari_groups.append(reportable_group) 
                elif num_liberties == 2:
                    atari_threat_groups.append(reportable_group)
        
        return atari_groups, atari_threat_groups

    def _check_captures(self, current_board: sgfmill.boards.Board, 
                       last_move_coords: Tuple[int, int], 
                       player_color: StoneColorSGF, 
                       board_before_move_list: BoardStateList) -> List[Tuple[int, int]]:
        """
        Detects if any stones were captured by the last move.
        Assumes `board_before_move_list` uses 'B'/'W'/'E'.
        """
        captured_stones: List[Tuple[int, int]] = []
        opponent_color: StoneColorSGF = self._get_opposite_color_sgf(player_color)

        for nr, nc in self._neighbors(*last_move_coords):
            # Get stone color from the *previous* board state list
            prev_state_char: StoneColorList = LIST_EMPTY # Default
            if self._is_on_board(nr, nc):
                prev_state_char = board_before_move_list[nr][nc]
            
            # Convert LIST_BLACK/LIST_WHITE to SGF_BLACK/SGF_WHITE for comparison
            prev_state_stone_sgf: StoneColorSGF = SGF_EMPTY
            if prev_state_char == LIST_BLACK:
                prev_state_stone_sgf = SGF_BLACK
            elif prev_state_char == LIST_WHITE:
                prev_state_stone_sgf = SGF_WHITE
                
            # If it was an opponent stone before, and is now empty, it was captured
            if prev_state_stone_sgf == opponent_color and current_board.get(nr, nc) is SGF_EMPTY:
                captured_stones.append((nr, nc))
        return captured_stones


    def analyze_patterns_after_move(
        self,
        move_number: int,
        row: int,
        col: int,
        player_color_char: str, # 'b' or 'w' from sgfmill
        current_board_obj: sgfmill.boards.Board,
        board_before_move_list: BoardStateList, # Re-introduced for capture detection
        report: Dict # The dictionary to populate with analysis results
    ) -> None:
        """
        Analyzes Go move patterns: move type (normal/contact), distances, atari, and captures.
        Populates the 'report' dictionary with the findings.

        Args:
            move_number (int): The current move number.
            row (int): Row of the newly placed stone.
            col (int): Column of the newly placed stone.
            player_color_char (str): Player's color ('b' or 'w').
            current_board_obj (sgfmill.boards.Board): The board state *after* the move.
            board_before_move_list (list[list[str]]): The board state *before* the move,
                                                        in list[list[str]] format ('B'/'W'/'E').
            report (dict): The dictionary to populate with analysis results.
        """
        player_color: StoneColorSGF = SGF_BLACK if player_color_char == 'b' else SGF_WHITE
        self.log.debug(f"Analyzing simplified patterns for move {move_number} at ({row},{col}) by {player_color_char}")

        # --- 1. Move type: Normal vs. Contact ---
        is_contact = self._is_contact_play(current_board_obj, row, col, player_color)
        report['type'] = 'Contact Move' if is_contact else 'Normal Move'

        # --- 2. Distance of the stone from center ---
        report['distance_from_center'] = self._calculate_distance_from_center(row, col)

        # --- 3. Distance from another of one's stones or groups ---
        report['distance_to_nearest_friendly_stone'] = self._calculate_distance_to_nearest_friendly_stone(
            current_board_obj, row, col, player_color
        )

        # --- 4. Self-Atari Detection ---
        report['self_atari'] = self._check_self_atari(current_board_obj, row, col)

        # --- 5. Atari / Atari Threat Detection ---
        atari_groups, atari_threat_groups = self._check_atari_threats(current_board_obj, row, col, player_color)
        report['atari'] = atari_groups
        report['atari_threats'] = atari_threat_groups

        # --- 6. Capture Detection ---
        captured_stones = self._check_captures(current_board_obj, (row, col), player_color, board_before_move_list)
        report['captures'] = captured_stones
        if captured_stones:
            report['type'] = 'Capture' # Overrides 'Normal Move' or 'Contact Move'
            report['captured_count'] = len(captured_stones)
        else:
            report['captured_count'] = 0 # Ensure this key exists even if no captures

        # --- Musical Intensity Mapping (updated for atari/capture) ---
        if report['self_atari'] or report['atari']:
            report['musical_intensity'] = 'high_tension' # Strong threat or danger
        elif report['type'] == 'Capture': # This will be set if captured_stones is not empty
            report['musical_intensity'] = 'percussive_hit' # Decisive outcome
        elif is_contact:
            report['musical_intensity'] = 'close_engagement' # Direct tactical interaction
        elif report['distance_from_center'] < 3.0: # Arbitrary threshold for 'central'
            report['musical_intensity'] = 'central_harmony' 
        elif report['distance_to_nearest_friendly_stone'] is not None and report['distance_to_nearest_friendly_stone'] < 2.0: # Arbitrary threshold for 'consolidation'
            report['musical_intensity'] = 'consolidation_melody'
        else:
            report['musical_intensity'] = 'background_pulse'


    def analyze_sgf_game(self, sgf_string: str) -> Optional[List[Dict]]:
        """
        Analyzes an SGF game string, processing each move and extracting Go-specific patterns.

        Args:
            sgf_string (str): The SGF game data as a string.

        Returns:
            Optional[List[Dict]]: A list of dictionaries, where each dictionary
                                   represents the analysis for a single move,
                                   or None if an error occurs during SGF parsing.
        """
        self.analysis_log = [] # Reset for new game
        self.log.info("Starting SGF game analysis.")
        
        try:
            game = sgfmill.sgf.Sgf_game.from_string(sgf_string)
            
            # We assume a fixed board size (e.g., 19x19) as per the requirement.
            # The Analyzer's 'self.board_size' will be used directly.
            self.log.info(f"Using Analyzer's configured board size ({self.board_size}x{self.board_size}) for SGF analysis.")
            board = sgfmill.boards.Board(self.board_size)
            
            main_sequence = list(game.get_main_sequence())
            
            # Start from the second node (index 1) as the first node (index 0) is the root node
            for i, node in enumerate(main_sequence[1:], start=1): 
                analysis_report: Dict = {}
                analysis_report['move_number'] = i
                
                # Get move details from sgfmill node
                color_char: Optional[str] # 'b', 'w', or None for pass
                coords: Optional[Tuple[int, int]] # (row, col) or None for pass
                color_char, coords = node.get_move() 

                analysis_report['player'] = color_char.upper() if color_char else 'PASS' # 'B' or 'W' or 'PASS'
                
                # Capture the board state *before* the current move is applied
                board_before_move_copy: BoardStateList = self._board_to_list(board)
                analysis_report['board_before_move_state'] = board_before_move_copy

                if coords is None: # It's a pass move
                    analysis_report['type'] = 'Pass'
                    analysis_report['coords'] = None
                    analysis_report['sgf_coords'] = ''
                    # These fields are not applicable for passes, setting to None or default
                    analysis_report['distance_from_center'] = None
                    analysis_report['distance_to_nearest_friendly_stone'] = None
                    analysis_report['self_atari'] = False
                    analysis_report['atari'] = []
                    analysis_report['atari_threats'] = []
                    analysis_report['captures'] = []
                    analysis_report['captured_count'] = 0
                    analysis_report['musical_intensity'] = 'rest' 
                else:
                    r, c = coords
                    analysis_report['coords'] = (r, c)
                    analysis_report['sgf_coords'] = self._coords_to_sgf_string(r, c) 
                    
                    try:
                        # Play the move on the sgfmill board object
                        # ko_point will be (r,c) if the move played creates ko
                        ko_point: Optional[Tuple[int, int]] = board.play(r, c, color_char) 
                        
                        if ko_point is not None:
                            analysis_report['ko_detected'] = True

                        # Analyze patterns *after* the move has been played on 'board'
                        self.analyze_patterns_after_move(
                            move_number=i, 
                            row=r, 
                            col=c, 
                            player_color_char=color_char, # 'b' or 'w'
                            current_board_obj=board, 
                            board_before_move_list=board_before_move_copy, # Pass this for capture detection
                            report=analysis_report
                        )

                    except Exception as e:
                        analysis_report['type'] = 'Illegal Move'
                        analysis_report['reason'] = str(e)
                        self.log.warning(f"Illegal move encountered at move {i} ({color_char}:{coords}): {e}")
                        # Ensure fields are present even for illegal moves
                        analysis_report['distance_from_center'] = None
                        analysis_report['distance_to_nearest_friendly_stone'] = None
                        analysis_report['self_atari'] = False
                        analysis_report['atari'] = []
                        analysis_report['atari_threats'] = []
                        analysis_report['captures'] = []
                        analysis_report['captured_count'] = 0
                        analysis_report['musical_intensity'] = 'error_sound' 

                # Capture the board state *after* the current move has been applied
                analysis_report['board_after_move_state'] = self._board_to_list(board)
                
                self.analysis_log.append(analysis_report)
            
            self.log.info(f"SGF analysis completed for {len(self.analysis_log)} moves.")
        except Exception as e:
            self.log.error(f"Critical error analyzing SGF game: {e}", exc_info=True)
            return None # Indicate failure
            
        return self.analysis_log