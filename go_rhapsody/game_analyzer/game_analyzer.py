import math
from logging import getLogger
from typing import List, Tuple, Set, Optional, Dict, Literal, FrozenSet
import sgfmill.sgf
import sgfmill.boards


# --- Type Aliases for Clarity ---
StoneColorSGF = Literal['b', 'w', None]
StoneColorList = Literal['B', 'W', 'E']
BoardStateList = List[List[StoneColorList]]
StoneGroup = Set[Tuple[int, int]]
FrozenStoneGroup = FrozenSet[Tuple[int, int]]

# --- Constants for Stone Colors ---
SGF_BLACK: Literal['b'] = 'b'
SGF_WHITE: Literal['w'] = 'w'
SGF_EMPTY: None = None

LIST_BLACK: Literal['B'] = 'B'
LIST_WHITE: Literal['W'] = 'W'
LIST_EMPTY: Literal['E'] = 'E'


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
        # Stores the (row, col) of the previous stone placement for each color.
        # Initialized in analyze_sgf_game.
        self.last_friendly_move_coords: Dict[StoneColorSGF, Optional[Tuple[int, int]]] = {SGF_BLACK: None, SGF_WHITE: None}

    def _coords_to_sgf_string(self, r: int, c: int) -> str:
        """
        Converts 0-indexed (row, col) to SGF string coordinates (e.g., (0,0) -> 'aa').
        """
        return chr(ord('a') + c) + chr(ord('a') + r)

    def _get_opposite_color_sgf(self, color: StoneColorSGF) -> StoneColorSGF:
        """
        Returns the opposite SGF stone color ('b' for 'w', 'w' for 'b').
        """
        if color == SGF_BLACK:
            return SGF_WHITE
        elif color == SGF_WHITE:
            return SGF_BLACK
        return SGF_EMPTY

    def _is_on_board(self, r: int, c: int) -> bool:
        """
        Checks if given coordinates (row, col) are within the board boundaries.
        """
        return 0 <= r < self.board_size and 0 <= c < self.board_size

    def _neighbors(self, r: int, c: int) -> List[Tuple[int, int]]:
        """
        Returns the list of valid orthogonal neighbor coordinates for a given point.
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
        """
        color: StoneColorSGF = board.get(*pos)
        if color is None:
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
        """
        liberties: Set[Tuple[int, int]] = set()
        for r, c in group:
            for nr, nc in self._neighbors(r, c):
                if board.get(nr, nc) is None:
                    liberties.add((nr, nc))
        return liberties

    def _board_to_list(self, board_obj: sgfmill.boards.Board) -> BoardStateList:
        """
        Converts an sgfmill board object to a list of lists for JSON serialization.
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
                else:
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
        Returns None if no other friendly stones exist.
        """
        min_dist: Optional[float] = None

        for r_other in range(self.board_size):
            for c_other in range(self.board_size):
                if (r_other, c_other) == (move_row, move_col): # Skip the stone just placed
                    continue

                if board.get(r_other, c_other) == player_color:
                    dist = math.sqrt((move_row - r_other)**2 + (move_col - c_other)**2)
                    if min_dist is None or dist < min_dist:
                        min_dist = dist
        return min_dist

    def _calculate_distance_to_nearest_enemy_stone(self, board: sgfmill.boards.Board,
                                                        move_row: int, move_col: int,
                                                        player_color: StoneColorSGF) -> Optional[float]:
        """
        Calculates the Euclidean distance to the nearest opponent stone.
        Returns None if no opponent stones exist on the board.
        """
        min_dist: Optional[float] = None
        opponent_color: StoneColorSGF = self._get_opposite_color_sgf(player_color)

        for r_other in range(self.board_size):
            for c_other in range(self.board_size):
                if board.get(r_other, c_other) == opponent_color:
                    dist = math.sqrt((move_row - r_other)**2 + (move_col - c_other)**2)
                    if min_dist is None or dist < min_dist:
                        min_dist = dist
        return min_dist

    def _calculate_distance_to_previous_friendly_stone(self, current_move_row: int, current_move_col: int, player_color: StoneColorSGF) -> Optional[float]:
        """
        Calculates the Euclidean distance between the current move and the previous stone placement
        by the *same player*.
        It relies on `self.last_friendly_move_coords` being correctly updated in `analyze_sgf_game`.

        Args:
            current_move_row (int): Row coordinate of the current move.
            current_move_col (int): Column coordinate of the current move.
            player_color (StoneColorSGF): The color of the current player.

        Returns:
            Optional[float]: The Euclidean distance to the previous friendly stone,
                             or None if there is no previous friendly stone for this player
                             (e.g., their first move or after a pass by them).
        """
        current_coords = (current_move_row, current_move_col)
        previous_friendly_coords = self.last_friendly_move_coords.get(player_color)

        if previous_friendly_coords is None:
            return None

        dx = current_coords[0] - previous_friendly_coords[0]
        dy = current_coords[1] - previous_friendly_coords[1]
        return math.sqrt(dx**2 + dy**2)


    def _check_atari_threats(self, board: sgfmill.boards.Board, row: int, col: int, player_color: StoneColorSGF) -> Tuple[List[Tuple], List[Tuple]]:
        """
        Checks for opponent groups now in atari or threatening atari (2 liberties).
        Returns lists of unique, sorted group tuples.
        """
        opponent_color: StoneColorSGF = self._get_opposite_color_sgf(player_color)
        atari_groups: List[Tuple] = []
        atari_threat_groups: List[Tuple] = []

        checked_groups: Set[FrozenStoneGroup] = set()

        for nr, nc in self._neighbors(row, col):
            if board.get(nr, nc) == opponent_color:
                opp_group: StoneGroup = self._get_group(board, (nr, nc))
                frozen_opp_group: FrozenStoneGroup = frozenset(opp_group)

                if frozen_opp_group in checked_groups:
                    continue
                checked_groups.add(frozen_opp_group)

                liberties: Set[Tuple[int, int]] = self._get_liberties(board, opp_group)
                num_liberties: int = len(liberties)

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
            prev_state_char: StoneColorList = LIST_EMPTY
            if self._is_on_board(nr, nc):
                prev_state_char = board_before_move_list[nr][nc]

            prev_state_stone_sgf: StoneColorSGF = SGF_EMPTY
            if prev_state_char == LIST_BLACK:
                prev_state_stone_sgf = SGF_BLACK
            elif prev_state_char == LIST_WHITE:
                prev_state_stone_sgf = SGF_WHITE

            if prev_state_stone_sgf == opponent_color and current_board.get(nr, nc) is SGF_EMPTY:
                # Check if the stone was actually captured (i.e., its group had 0 liberties *after* the opponent's move)
                # This part is implicit with current_board.get(nr,nc) is SGF_EMPTY, meaning the stone is gone.
                # If we wanted to be more rigorous about *which* group was captured, we'd need
                # to get the group from board_before_move_list and check its liberties on the *current* board.
                # However, for simply listing captured stones by coordinate, this is sufficient.
                captured_stones.append((nr, nc))
        return captured_stones


    def analyze_pattern_after_move(
        self,
        move_number: int,
        row: int,
        col: int,
        player_color_char: str,
        current_board_obj: sgfmill.boards.Board,
        board_before_move_list: BoardStateList,
        report: Dict
    ) -> None:
        """
        Analyzes Go move patterns: move type (prioritized), and distances.
        Populates the 'report' dictionary with the findings.
        """
        player_color: StoneColorSGF = SGF_BLACK if player_color_char == 'b' else SGF_WHITE
        self.log.debug(f"Analyzing patterns for move {move_number} at ({row},{col}) by {player_color_char}")

        # --- Distance Calculations ---
        report['distance_from_center'] = self._calculate_distance_from_center(row, col)
        report['distance_to_nearest_friendly_stone'] = self._calculate_distance_to_nearest_friendly_stone(
            current_board_obj, row, col, player_color
        )
        report['distance_to_nearest_enemy_stone'] = self._calculate_distance_to_nearest_enemy_stone(
            current_board_obj, row, col, player_color
        )
        # Corrected call to _calculate_distance_to_previous_friendly_stone
        report['distance_from_previous_friendly_stone'] = self._calculate_distance_to_previous_friendly_stone(row, col, player_color)

        # --- Core Go patterns for Type and Musical Intensity ---
        atari_groups, atari_threat_groups = self._check_atari_threats(current_board_obj, row, col, player_color)
        captured_stones = self._check_captures(current_board_obj, (row, col), player_color, board_before_move_list)
        is_contact = self._is_contact_play(current_board_obj, row, col, player_color)

        report['atari'] = atari_groups
        report['atari_threats'] = atari_threat_groups
        report['captures'] = captured_stones
        report['captured_count'] = len(captured_stones) if captured_stones else 0

        # --- Determine Main Move Type (Prioritized) ---
        if captured_stones:
            report['type'] = 'Capture'
            report['musical_intensity'] = 'percussive_hit'
        elif atari_groups:
            report['type'] = 'Atari'
            report['musical_intensity'] = 'high_tension'
        elif atari_threat_groups:
            report['type'] = 'Atari Threat'
            report['musical_intensity'] = 'rising_tension'
        elif is_contact:
            report['type'] = 'Contact Move'
            report['musical_intensity'] = 'close_engagement'
        else:
            report['type'] = 'Normal Move'
            report['musical_intensity'] = 'background_pulse'


    def analyze_sgf_game(self, sgf_string: str) -> Optional[List[Dict]]:
        """
        Analyzes an SGF game string, processing each move and extracting Go-specific patterns.
        Does not handle illegal moves; any sgfmill errors will halt the analysis.

        Args:
            sgf_string (str): The SGF game data as a string.

        Returns:
            Optional[List[Dict]]: A list of dictionaries, where each dictionary
                                   represents the analysis for a single move,
                                   or None if an error occurs during SGF parsing.
        """
        self.analysis_log = []
        self.log.info("Starting SGF game analysis.")

        try:
            game = sgfmill.sgf.Sgf_game.from_string(sgf_string)

            self.log.info(f"Using Analyzer's configured board size ({self.board_size}x{self.board_size}) for SGF analysis.")
            board = sgfmill.boards.Board(self.board_size)

            main_sequence: List[sgfmill.sgf.Sgf_node] = list(game.get_main_sequence())

            # Reset previous_friendly_move_coords for a new game analysis
            self.last_friendly_move_coords = {SGF_BLACK: None, SGF_WHITE: None}

            for i, node in enumerate(main_sequence[1:], start=1):
                analysis_report: Dict = {}
                analysis_report['move_number'] = i

                color_char: Optional[str]
                coords: Optional[Tuple[int, int]]
                color_char, coords = node.get_move()

                analysis_report['player'] = color_char.upper() if color_char else 'PASS'

                board_before_move_copy: BoardStateList = self._board_to_list(board)
                analysis_report['board_before_move_state'] = board_before_move_copy

                if coords is None: # Pass move
                    analysis_report['type'] = 'Pass'
                    analysis_report['coords'] = None
                    analysis_report['sgf_coords'] = ''
                    analysis_report['distance_from_center'] = None
                    analysis_report['distance_to_nearest_friendly_stone'] = None
                    analysis_report['distance_to_nearest_enemy_stone'] = None
                    analysis_report['atari'] = []
                    analysis_report['atari_threats'] = []
                    analysis_report['captures'] = []
                    analysis_report['captured_count'] = 0
                    analysis_report['musical_intensity'] = 'rest'
                    # For pass moves, distance from previous friendly stone is not applicable
                    analysis_report['distance_from_previous_friendly_stone'] = None
                    # last_friendly_move_coords should NOT be updated on a pass
                else: # Stone placement move
                    r, c = coords
                    player_color: StoneColorSGF = SGF_BLACK if color_char == 'b' else SGF_WHITE

                    analysis_report['coords'] = (r, c)
                    analysis_report['sgf_coords'] = self._coords_to_sgf_string(r, c)

                    # Play the move on the sgfmill board object.
                    # No explicit error handling here; illegal moves will raise exceptions.
                    ko_point: Optional[Tuple[int, int]] = board.play(r, c, color_char)

                    if ko_point is not None:
                        analysis_report['ko_detected'] = True

                    self.analyze_pattern_after_move(
                        move_number=i,
                        row=r,
                        col=c,
                        player_color_char=color_char,
                        current_board_obj=board,
                        board_before_move_list=board_before_move_copy,
                        report=analysis_report
                    )
                    # Update previous_friendly_move_coords for the current player *after*
                    # the current move has been processed for the next iteration.
                    self.last_friendly_move_coords[player_color] = (r, c)

                analysis_report['board_after_move_state'] = self._board_to_list(board)

                self.analysis_log.append(analysis_report)

            self.log.info(f"SGF analysis completed for {len(self.analysis_log)} moves.")
        except Exception as e:
            self.log.error(f"Critical error analyzing SGF game: {e}", exc_info=True)
            return None # Indicate failure

        return self.analysis_log