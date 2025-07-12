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
CornerName = Literal['top_left', 'top_right', 'bottom_left', 'bottom_right']


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
        # State to track new opening patterns
        self.first_corner_played: Dict[StoneColorSGF, bool] = {SGF_BLACK: False, SGF_WHITE: False}

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
        """
        previous_friendly_coords = self.last_friendly_move_coords.get(player_color)

        if previous_friendly_coords is None:
            return None

        dx = current_move_row - previous_friendly_coords[0]
        dy = current_move_col - previous_friendly_coords[1]
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
        """
        captured_stones: List[Tuple[int, int]] = []
        opponent_color_list: StoneColorList = LIST_BLACK if player_color == SGF_WHITE else LIST_WHITE

        # Iterate over all squares to find stones that disappeared
        for r in range(self.board_size):
            for c in range(self.board_size):
                if board_before_move_list[r][c] == opponent_color_list and current_board.get(r, c) is SGF_EMPTY:
                    captured_stones.append((r, c))
        return captured_stones

    # --- NEW: Helper functions for opening patterns ---

    def _get_corner_name_and_bounds(self, r: int, c: int) -> Optional[Tuple[CornerName, Tuple[int, int, int, int]]]:
        """
        Identifies which corner a coordinate is in and returns its name and boundaries.
        A corner is defined as roughly the 4x4 area.
        """
        corner_size = 4
        # Top-left
        if 0 <= r < corner_size and 0 <= c < corner_size:
            return 'top_left', (0, corner_size - 1, 0, corner_size - 1)
        # Top-right
        if 0 <= r < corner_size and self.board_size - corner_size <= c < self.board_size:
            return 'top_right', (0, corner_size - 1, self.board_size - corner_size, self.board_size - 1)
        # Bottom-left
        if self.board_size - corner_size <= r < self.board_size and 0 <= c < corner_size:
            return 'bottom_left', (self.board_size - corner_size, self.board_size - 1, 0, corner_size - 1)
        # Bottom-right
        if self.board_size - corner_size <= r < self.board_size and self.board_size - corner_size <= c < self.board_size:
            return 'bottom_right', (self.board_size - corner_size, self.board_size - 1, self.board_size - corner_size, self.board_size - 1)
        return None

    def _is_star_point(self, r: int, c: int) -> bool:
        """Checks if a move is on a 4-4 'star point' on a 19x19 board."""
        if self.board_size != 19: return False
        return (r, c) in [(3, 3), (3, 15), (15, 3), (15, 15)]

    def _is_3_3_point(self, r: int, c: int) -> bool:
        """Checks if a move is on a 3-3 point on a 19x19 board."""
        if self.board_size != 19: return False
        return (r, c) in [(2, 2), (2, 16), (16, 2), (16, 16)]

    def _is_3_4_point(self, r: int, c: int) -> bool:
        """Checks if a move is on a 3-4 point or 4-3 point on a 19x19 board."""
        if self.board_size != 19: return False
        return (r, c) in [(2, 3), (3, 2), (2, 15), (15, 2), (15, 16), (16, 15), (3, 16), (16, 3)]

    def _check_friendly_stone_in_corner(self,
                                        corner_bounds: Tuple[int, int, int, int],
                                        player_color_list: StoneColorList,
                                        board_state_list: BoardStateList) -> bool:
        """Checks if a friendly stone already exists within the given corner bounds."""
        min_r, max_r, min_c, max_c = corner_bounds
        for r in range(min_r, max_r + 1):
            for c in range(min_c, max_c + 1):
                if board_state_list[r][c] == player_color_list:
                    return True
        return False

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
        player_color_list: StoneColorList = LIST_BLACK if player_color_char == 'b' else LIST_WHITE
        self.log.debug(f"Analyzing patterns for move {move_number} at ({row},{col}) by {player_color_char}")

        # --- Distance Calculations ---
        report['distance_from_center'] = self._calculate_distance_from_center(row, col)
        report['distance_to_nearest_friendly_stone'] = self._calculate_distance_to_nearest_friendly_stone(
            current_board_obj, row, col, player_color
        )
        report['distance_to_nearest_enemy_stone'] = self._calculate_distance_to_nearest_enemy_stone(
            current_board_obj, row, col, player_color
        )
        report['distance_from_previous_friendly_stone'] = self._calculate_distance_to_previous_friendly_stone(row, col, player_color)

        # --- Core Go patterns for Type and Musical Intensity (Prioritized) ---
        atari_groups, atari_threat_groups = self._check_atari_threats(current_board_obj, row, col, player_color)
        captured_stones = self._check_captures(current_board_obj, (row, col), player_color, board_before_move_list)
        is_contact = self._is_contact_play(current_board_obj, row, col, player_color)

        report['atari'] = atari_groups
        report['atari_threats'] = atari_threat_groups
        report['captures'] = captured_stones
        report['captured_count'] = len(captured_stones)

        # --- Determine Main Move Type (Prioritized) ---
        move_type_set = False
        if captured_stones:
            report['type'] = 'Capture'
            report['musical_intensity'] = 'percussive_hit'
            move_type_set = True
        elif atari_groups:
            report['type'] = 'Atari'
            report['musical_intensity'] = 'high_tension'
            move_type_set = True
        elif atari_threat_groups:
            report['type'] = 'Atari Threat'
            report['musical_intensity'] = 'rising_tension'
            move_type_set = True

        if not move_type_set:
            # --- NEW: Check for opening and corner patterns ---
            if self._is_star_point(row, col):
                report['type'] = 'Star Point'
                report['musical_intensity'] = 'star_point_chime'
            elif self._is_3_3_point(row, col):
                report['type'] = '3-3 Point'
                report['musical_intensity'] = 'three_three_drone'
            elif self._is_3_4_point(row, col):
                report['type'] = '3-4 Point'
                report['musical_intensity'] = 'three_four_motif'
            else:
                corner_info = self._get_corner_name_and_bounds(row, col)
                if corner_info:
                    corner_name, corner_bounds = corner_info
                    # Check for enclosure by looking for a friendly stone in the corner *before* this move
                    has_friendly_in_corner_before = self._check_friendly_stone_in_corner(
                        corner_bounds, player_color_list, board_before_move_list
                    )
                    if has_friendly_in_corner_before:
                        report['type'] = 'Corner Enclosure'
                        report['musical_intensity'] = 'corner_secure'
                    elif not self.first_corner_played[player_color]:
                        report['type'] = 'First Corner Play'
                        report['musical_intensity'] = 'opening_theme'
                        self.first_corner_played[player_color] = True
            
            # --- Fallback to existing contact/normal move logic if no other type was set ---
            if 'type' not in report:
                if is_contact:
                    report['type'] = 'Contact Move'
                    report['musical_intensity'] = 'close_engagement'
                else:
                    report['type'] = 'Normal Move'
                    report['musical_intensity'] = 'background_pulse'


    def analyze_sgf_game(self, sgf_string: str) -> Optional[List[Dict]]:
        """
        Analyzes an SGF game string, processing each move and extracting Go-specific patterns.
        """
        self.analysis_log = []
        self.log.info("Starting SGF game analysis.")

        try:
            game = sgfmill.sgf.Sgf_game.from_string(sgf_string)
            self.log.info(f"Using Analyzer's configured board size ({self.board_size}x{self.board_size}) for SGF analysis.")
            board = sgfmill.boards.Board(self.board_size)
            main_sequence: List[sgfmill.sgf.Sgf_node] = list(game.get_main_sequence())

            # Reset state for the new game analysis
            self.last_friendly_move_coords = {SGF_BLACK: None, SGF_WHITE: None}
            self.first_corner_played = {SGF_BLACK: False, SGF_WHITE: False}

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
                    # Set default values for a pass move
                    for key in ['coords', 'sgf_coords', 'distance_from_center', 'distance_to_nearest_friendly_stone',
                                'distance_to_nearest_enemy_stone', 'distance_from_previous_friendly_stone']:
                        analysis_report[key] = None
                    for key in ['atari', 'atari_threats', 'captures']:
                        analysis_report[key] = []
                    analysis_report['captured_count'] = 0
                    analysis_report['musical_intensity'] = 'rest'
                else: # Stone placement move
                    r, c = coords
                    player_color_sgf: StoneColorSGF = SGF_BLACK if color_char == 'b' else SGF_WHITE

                    analysis_report['coords'] = (r, c)
                    analysis_report['sgf_coords'] = self._coords_to_sgf_string(r, c)

                    # Play the move on the sgfmill board object.
                    ko_point: Optional[Tuple[int, int]] = board.play(r, c, color_char)
                    if ko_point is not None:
                        analysis_report['ko_detected'] = True

                    self.analyze_pattern_after_move(
                        move_number=i, row=r, col=c, player_color_char=color_char,
                        current_board_obj=board, board_before_move_list=board_before_move_copy,
                        report=analysis_report
                    )
                    # Update the last move coordinate for the current player for the next iteration.
                    self.last_friendly_move_coords[player_color_sgf] = (r, c)

                analysis_report['board_after_move_state'] = self._board_to_list(board)
                self.analysis_log.append(analysis_report)

            self.log.info(f"SGF analysis completed for {len(self.analysis_log)} moves.")
        except Exception as e:
            self.log.error(f"Critical error analyzing SGF game: {e}", exc_info=True)
            return None # Indicate failure

        return self.analysis_log