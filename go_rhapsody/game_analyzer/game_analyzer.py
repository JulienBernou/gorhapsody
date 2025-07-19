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
        self.log.info(f"GameAnalyzer initialized for a {board_size}x{self.board_size} board.")
        # self.last_friendly_move_coords: Dict[StoneColorSGF, Optional[Tuple[int, int]]] = {SGF_BLACK: None, SGF_WHITE: None} # This will now be passed
        self.first_corner_played: Dict[StoneColorSGF, bool] = {SGF_BLACK: False, SGF_WHITE: False}

    def _coords_to_sgf_string(self, r: int, c: int) -> str:
        return chr(ord('a') + c) + chr(ord('a') + r)

    def _get_opposite_color_sgf(self, color: StoneColorSGF) -> StoneColorSGF:
        if color == SGF_BLACK:
            return SGF_WHITE
        elif color == SGF_WHITE:
            return SGF_BLACK
        return SGF_EMPTY

    def _is_on_board(self, r: int, c: int) -> bool:
        return 0 <= r < self.board_size and 0 <= c < self.board_size

    def _neighbors(self, r: int, c: int) -> List[Tuple[int, int]]:
        neighbors_list: List[Tuple[int, int]] = []
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if self._is_on_board(nr, nc):
                neighbors_list.append((nr, nc))
        return neighbors_list

    def _get_group(self, board: sgfmill.boards.Board, pos: Tuple[int, int]) -> StoneGroup:
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
        liberties: Set[Tuple[int, int]] = set()
        for r, c in group:
            for nr, nc in self._neighbors(r, c):
                if board.get(nr, nc) is None:
                    liberties.add((nr, nc))
        return liberties

    def _board_to_list(self, board_obj: sgfmill.boards.Board) -> BoardStateList:
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
        opponent_color: StoneColorSGF = self._get_opposite_color_sgf(player_color)
        return any(board.get(nr, nc) == opponent_color for nr, nc in self._neighbors(row, col))

    def _calculate_distance_from_center(self, r: int, c: int) -> float:
        center_coord = (self.board_size - 1) / 2.0
        return math.sqrt((r - center_coord)**2 + (c - center_coord)**2)

    def _calculate_distance_to_nearest_friendly_stone(self, board: sgfmill.boards.Board, move_row: int, move_col: int, player_color: StoneColorSGF) -> Optional[float]:
        min_dist: Optional[float] = None
        for r_other in range(self.board_size):
            for c_other in range(self.board_size):
                if (r_other, c_other) == (move_row, move_col):
                    continue
                if board.get(r_other, c_other) == player_color:
                    dist = math.sqrt((move_row - r_other)**2 + (move_col - c_other)**2)
                    if min_dist is None or dist < min_dist:
                        min_dist = dist
        return min_dist

    def _calculate_distance_to_nearest_enemy_stone(self, board: sgfmill.boards.Board, move_row: int, move_col: int, player_color: StoneColorSGF) -> Optional[float]:
        min_dist: Optional[float] = None
        opponent_color: StoneColorSGF = self._get_opposite_color_sgf(player_color)
        for r_other in range(self.board_size):
            for c_other in range(self.board_size):
                if board.get(r_other, c_other) == opponent_color:
                    dist = math.sqrt((move_row - r_other)**2 + (move_col - c_other)**2)
                    if min_dist is None or dist < min_dist:
                        min_dist = dist
        return min_dist

    def _calculate_distance_to_previous_friendly_stone(self, current_move_row: int, current_move_col: int, player_color: StoneColorSGF, last_friendly_move_coords_dict: Dict[StoneColorSGF, Optional[Tuple[int, int]]]) -> Optional[float]:
        previous_friendly_coords = last_friendly_move_coords_dict.get(player_color)
        if previous_friendly_coords is None:
            return None
        dx = current_move_row - previous_friendly_coords[0]
        dy = current_move_col - previous_friendly_coords[1]
        return math.sqrt(dx**2 + dy**2)

    def _check_atari_threats(self, board: sgfmill.boards.Board, row: int, col: int, player_color: StoneColorSGF) -> Tuple[List[Tuple], List[Tuple]]:
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

    def _check_captures(self, current_board: sgfmill.boards.Board, player_color: StoneColorSGF, board_before_move_list: BoardStateList) -> List[Tuple[int, int]]:
        captured_stones: List[Tuple[int, int]] = []
        opponent_color_list: StoneColorList = LIST_BLACK if player_color == SGF_WHITE else LIST_WHITE
        for r in range(self.board_size):
            for c in range(self.board_size):
                if board_before_move_list[r][c] == opponent_color_list and current_board.get(r, c) is SGF_EMPTY:
                    captured_stones.append((r, c))
        return captured_stones

    def _get_corner_name_and_bounds(self, r: int, c: int) -> Optional[Tuple[CornerName, Tuple[int, int, int, int]]]:
        corner_size = 5 # Widen the definition of a corner slightly for these enclosures
        if 0 <= r <= corner_size and 0 <= c <= corner_size:
            return 'top_left', (0, corner_size, 0, corner_size)
        if 0 <= r <= corner_size and self.board_size - corner_size -1 <= c < self.board_size:
            return 'top_right', (0, corner_size, self.board_size - corner_size - 1, self.board_size - 1)
        if self.board_size - corner_size -1 <= r < self.board_size and 0 <= c <= corner_size:
            return 'bottom_left', (self.board_size - corner_size - 1, self.board_size - 1, 0, corner_size)
        if self.board_size - corner_size -1 <= r < self.board_size and self.board_size - corner_size -1 <= c < self.board_size:
            return 'bottom_right', (self.board_size - corner_size - 1, self.board_size - 1, self.board_size - corner_size-1, self.board_size - 1)
        return None

    def _is_star_point(self, r: int, c: int) -> bool:
        if self.board_size != 19: return False
        return (r, c) in [(3, 3), (3, 15), (15, 3), (15, 15)]

    def _is_3_3_point(self, r: int, c: int) -> bool:
        if self.board_size != 19: return False
        return (r, c) in [(2, 2), (2, 16), (16, 2), (16, 16)]

    def _is_3_4_point(self, r: int, c: int) -> bool:
        if self.board_size != 19: return False
        return (r, c) in [(2, 3), (3, 2), (2, 15), (15, 2), (15, 16), (16, 15), (3, 16), (16, 3)]

    def _check_friendly_stone_in_corner(self, corner_bounds: Tuple[int, int, int, int], player_color_list: StoneColorList, board_state_list: BoardStateList, stone_coords_to_find: Set[Tuple[int, int]]) -> bool:
        min_r, max_r, min_c, max_c = corner_bounds
        for r in range(min_r, max_r + 1):
            for c in range(min_c, max_c + 1):
                if (r, c) in stone_coords_to_find and board_state_list[r][c] == player_color_list:
                    return True
        return False

    def _get_coords_in_corner(self, r: int, c: int, coords_to_check: Set[Tuple[int, int]]) -> Set[Tuple[int, int]]:
        """Given a point (r,c) on a 19x19 board, returns the symmetrical corner coordinates."""
        sym_coords = set()
        # Determine corner quadrant from input (r, c)
        is_top = r < self.board_size / 2
        is_left = c < self.board_size / 2
        
        for r_check, c_check in coords_to_check:
            sym_r = r_check if is_top else self.board_size - 1 - r_check
            sym_c = c_check if is_left else self.board_size - 1 - c_check
            sym_coords.add((sym_r, sym_c))
        return sym_coords

    def _check_large_enclosure(self, r: int, c: int, player_color_list: StoneColorList, board_before_move: BoardStateList) -> Optional[str]:
        """Checks for the new 5-3, 5-4, 6-3, 6-4 enclosures relative to a 3-4 stone."""
        if self.board_size != 19: return None
        
        # Define the canonical (top-left) coordinates for the enclosures and the 3-4 stone
        enclosure_map = {
            (4, 2): "5-3 Enclosure", (2, 4): "3-5 Enclosure",
            (4, 3): "5-4 Enclosure", (3, 4): "4-5 Enclosure",
            (5, 2): "6-3 Enclosure", (2, 5): "3-6 Enclosure",
            (5, 3): "6-4 Enclosure", (3, 5): "4-6 Enclosure",
        }
        # Canonical 3-4 points in top-left
        three_four_points = {(2, 3), (3, 2)}

        # Get the symmetric coordinates for the current move
        current_move_sym = self._get_coords_in_corner(r, c, {(r, c)})
        if not current_move_sym: return None
        canonical_move = next(iter(current_move_sym))

        enclosure_type = enclosure_map.get(canonical_move)
        if not enclosure_type:
            return None # The current move is not one of the target enclosure points

        corner_info = self._get_corner_name_and_bounds(r, c)
        if not corner_info: return None
        _, corner_bounds = corner_info
        
        # Get the symmetric 3-4 points for this specific corner
        sym_3_4_points = self._get_coords_in_corner(r, c, three_four_points)

        # Check if one of the required 3-4 stones exists in the corner
        if self._check_friendly_stone_in_corner(corner_bounds, player_color_list, board_before_move, sym_3_4_points):
            return enclosure_type # Return the canonical name
            
        return None


    def analyze_pattern_after_move(self, move_number: int, row: int, col: int, player_color_char: str, current_board_obj: sgfmill.boards.Board, board_before_move_list: BoardStateList, report: Dict, last_friendly_move_coords: Dict[StoneColorSGF, Optional[Tuple[int, int]]]) -> None:
        player_color: StoneColorSGF = SGF_BLACK if player_color_char == 'b' else SGF_WHITE
        player_color_list: StoneColorList = LIST_BLACK if player_color_char == 'b' else LIST_WHITE
        self.log.debug(f"Analyzing patterns for move {move_number} at ({row},{col}) by {player_color_char}")

        report['distance_from_center'] = self._calculate_distance_from_center(row, col)
        report['distance_to_nearest_friendly_stone'] = self._calculate_distance_to_nearest_friendly_stone(current_board_obj, row, col, player_color)
        report['distance_to_nearest_enemy_stone'] = self._calculate_distance_to_nearest_enemy_stone(current_board_obj, row, col, player_color)
        report['distance_from_previous_friendly_stone'] = self._calculate_distance_to_previous_friendly_stone(row, col, player_color, last_friendly_move_coords)

        atari_groups, atari_threat_groups = self._check_atari_threats(current_board_obj, row, col, player_color)
        captured_stones = self._check_captures(current_board_obj, player_color, board_before_move_list)
        is_contact = self._is_contact_play(current_board_obj, row, col, player_color)

        report['atari'] = atari_groups
        report['atari_threats'] = atari_threat_groups
        report['captures'] = captured_stones
        report['captured_count'] = len(captured_stones)

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

        # New condition: If distance to nearest friendly stone is 1.0, bypass enclosure detections
        if report['distance_to_nearest_friendly_stone'] == 1.0:
            self.log.debug(f"Skipping enclosure detection for ({row},{col}) due to distance to nearest friendly stone being 1.0.")
            if not move_type_set: # If no capture/atari was detected, default to Contact or Normal Move
                if is_contact:
                    report['type'] = 'Contact Move'
                    report['musical_intensity'] = 'close_engagement'
                else:
                    report['type'] = 'Normal Move'
                    report['musical_intensity'] = 'background_pulse'
            return # Exit the function early to prevent further enclosure/point type checks

        # Original enclosure/point type checks (only run if not a "distance 1" move)
        if not move_type_set:
            large_enclosure_type = self._check_large_enclosure(row, col, player_color_list, board_before_move_list)
            if large_enclosure_type:
                report['type'] = large_enclosure_type
                report['musical_intensity'] = 'large_enclosure_chime'
            elif self._is_star_point(row, col):
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
                    _, corner_bounds = corner_info
                    if self._check_friendly_stone_in_corner(corner_bounds, player_color_list, board_before_move_list, {(row, col)}):
                        report['type'] = 'Corner Enclosure'
                        report['musical_intensity'] = 'corner_secure'
                    elif not self.first_corner_played.get(player_color):
                        report['type'] = 'First Corner Play'
                        report['musical_intensity'] = 'opening_theme'
                        self.first_corner_played[player_color] = True
            
            if 'type' not in report:
                if is_contact:
                    report['type'] = 'Contact Move'
                    report['musical_intensity'] = 'close_engagement'
                else:
                    report['type'] = 'Normal Move'
                    report['musical_intensity'] = 'background_pulse'

    def analyze_sgf_game(self, sgf_string: str) -> Optional[List[Dict]]:
        self.analysis_log = []
        self.log.info("Starting SGF game analysis.")
        try:
            game = sgfmill.sgf.Sgf_game.from_string(sgf_string)
            self.log.info(f"Using Analyzer's configured board size ({self.board_size}x{self.board_size}) for SGF analysis.")
            board = sgfmill.boards.Board(self.board_size)
            main_sequence: List[sgfmill.sgf.Sgf_node] = list(game.get_main_sequence())

            # last_friendly_move_coords is now a local variable in analyze_sgf_game
            last_friendly_move_coords: Dict[StoneColorSGF, Optional[Tuple[int, int]]] = {SGF_BLACK: None, SGF_WHITE: None}
            self.first_corner_played = {SGF_BLACK: False, SGF_WHITE: False}

            for i, node in enumerate(main_sequence[1:], start=1):
                analysis_report: Dict = {}
                analysis_report['move_number'] = i
                color_char, coords = node.get_move()
                analysis_report['player'] = color_char.upper() if color_char else 'PASS'
                board_before_move_copy: BoardStateList = self._board_to_list(board)
                analysis_report['board_before_move_state'] = board_before_move_copy

                if coords is None:
                    analysis_report['type'] = 'Pass'
                    for key in ['coords', 'sgf_coords', 'distance_from_center', 'distance_to_nearest_friendly_stone', 'distance_to_nearest_enemy_stone', 'distance_from_previous_friendly_stone']:
                        analysis_report[key] = None
                    for key in ['atari', 'atari_threats', 'captures']:
                        analysis_report[key] = []
                    analysis_report['captured_count'] = 0
                    analysis_report['musical_intensity'] = 'rest'
                else:
                    r, c = coords
                    player_color_sgf: StoneColorSGF = SGF_BLACK if color_char == 'b' else SGF_WHITE
                    analysis_report['coords'] = (r, c)
                    analysis_report['sgf_coords'] = self._coords_to_sgf_string(r, c)
                    ko_point: Optional[Tuple[int, int]] = board.play(r, c, color_char)
                    if ko_point is not None:
                        analysis_report['ko_detected'] = True
                    # Pass last_friendly_move_coords to analyze_pattern_after_move
                    self.analyze_pattern_after_move(move_number=i, row=r, col=c, player_color_char=color_char, current_board_obj=board, board_before_move_list=board_before_move_copy, report=analysis_report, last_friendly_move_coords=last_friendly_move_coords)
                    last_friendly_move_coords[player_color_sgf] = (r, c) # Update the local variable

                analysis_report['board_after_move_state'] = self._board_to_list(board)
                self.analysis_log.append(analysis_report)

            self.log.info(f"SGF analysis completed for {len(self.analysis_log)} moves.")
        except Exception as e:
            self.log.error(f"Critical error analyzing SGF game: {e}", exc_info=True)
            return None
        return self.analysis_log